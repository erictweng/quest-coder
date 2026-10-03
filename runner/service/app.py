#!/usr/bin/env python3
"""Credential-protected Quest Coder runner gateway."""
from __future__ import annotations

import hmac
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runner.bounded_subprocess import OutputLimitExceeded, run_bounded
from runner.private_pack import ALLOWED_CHALLENGE_IDS, ALLOWED_PACK_SLUG, PRIVATE_PACK_ENV, load_private_pack
from runner.service.request_body import RequestBodyError, RequestBodyTooLarge, read_bounded_body

TOKEN = os.environ.get("QUEST_CODER_RUNNER_TOKEN", "")
HOST = os.environ.get("QUEST_CODER_RUNNER_HOST", "127.0.0.1")
PORT = int(os.environ.get("QUEST_CODER_RUNNER_PORT", "8787"))
MAX_BODY = 24_000 + 1024
MAX_OUTPUT = 1_000_000
MAX_ERROR_OUTPUT = 64_000
# Backstop only: the CLI enforces its own 5.5s whole-submission deadline.
TIMEOUT_SECONDS = 7
HIDDEN_ERROR_MESSAGES = {
    "compile_error": "The code did not compile.",
    "runtime_error": "The code raised an error on a hidden case.",
    "loop_guard": "The code did not finish in time on a hidden case.",
    "off_end_read": "The code read outside a list on a hidden case.",
}
RUN_SLOTS = threading.BoundedSemaphore(value=2)


class Handler(BaseHTTPRequestHandler):
    server_version = "QuestCoderRunner/1"
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path not in {"/healthz", "/readyz"}:
            return self.reply(404, {"error": "not found"})
        if self.path == "/readyz" and not self.authorized():
            return self.reply(401, {"error": "unauthorized", "code": "unauthorized"})
        self.reply(200, {"status": "ok", "version": "runner-service-v1"})

    def do_POST(self):
        if self.path != "/v1/runs":
            return self.reply(404, {"error": "not found"})
        if not self.authorized():
            return self.reply(401, {"error": "unauthorized", "code": "unauthorized"})
        try:
            payload = json.loads(read_bounded_body(self.rfile, self.headers, MAX_BODY))
            validate(payload)
            if not RUN_SLOTS.acquire(blocking=False):
                return self.reply(429, {"error": "runner is busy; retry shortly", "code": "queue_full"})
            try:
                proc = run_bounded(
                    [sys.executable, "runner/quest_runner_cli.py"],
                    cwd=str(ROOT),
                    input_bytes=json.dumps(payload).encode(),
                    timeout=TIMEOUT_SECONDS,
                    stdout_limit=MAX_OUTPUT,
                    stderr_limit=MAX_ERROR_OUTPUT,
                    env=worker_env(),
                )
            finally:
                RUN_SLOTS.release()
            if proc.returncode != 0:
                return self.reply(422, {"error": safe_error(proc.stderr), "code": "runner_rejected"})
            result = json.loads(proc.stdout)
            self.reply(200, redact_hidden_cases(result, payload["mode"]))
        except RequestBodyTooLarge:
            self.reply(413, {"error": "request too large", "code": "request_too_large"})
        except OutputLimitExceeded:
            self.reply(502, {"error": "runner response too large", "code": "response_too_large"})
        except subprocess.TimeoutExpired:
            self.reply(504, {"error": "Execution timed out. Check for an infinite loop.", "code": "runner_timeout"})
        except (RequestBodyError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            self.reply(400, {"error": str(exc), "code": "invalid_request"})
        except Exception:
            self.reply(500, {"error": "runner service failed", "code": "runner_error"})

    def authorized(self):
        supplied = self.headers.get("authorization") or ""
        return bool(TOKEN) and hmac.compare_digest(supplied.encode(), f"Bearer {TOKEN}".encode())

    def reply(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.close_connection = True
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.send_header("connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        sys.stderr.write("runner-service: " + format % args + "\n")


def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError("request body must be an object")
    allowed = {"source", "packSlug", "challengeId", "mode"}
    unknown = set(payload) - allowed
    if unknown:
        raise ValueError(f"unknown field: {sorted(unknown)[0]}")
    source = payload.get("source")
    if not isinstance(source, str) or not source.strip():
        raise ValueError("source must be a non-empty Python string")
    if len(source.encode()) > 24_000:
        raise ValueError("source exceeds public limit")
    if payload.get("packSlug") != ALLOWED_PACK_SLUG:
        raise ValueError("unknown pack")
    if payload.get("challengeId") not in ALLOWED_CHALLENGE_IDS:
        raise ValueError("unknown challenge")
    if payload.get("mode") not in {"run", "submit"}:
        raise ValueError("mode must be run or submit")


def worker_env():
    return {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONPATH": str(ROOT),
        "PYTHONSAFEPATH": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
        "QUEST_CODER_PUBLIC_HARDENED": "1",
        PRIVATE_PACK_ENV: os.environ.get(PRIVATE_PACK_ENV, ""),
    }


def safe_error(stderr: bytes):
    try:
        return json.loads(stderr.decode("utf-8")).get("error", "runner rejected submission")
    except Exception:
        return "runner rejected submission"


def redact_hidden_cases(result, mode):
    if mode != "submit":
        return result
    safe = dict(result)
    cases = []
    for index, case in enumerate(result.get("cases", []), 1):
        cases.append({
            "caseId": f"hidden-{index}", "status": case.get("status"), "passed": case.get("passed"),
            "expected": None, "actual": None, "arguments": {}, "error": redact_hidden_error(case.get("error")),
            "budget": case.get("budget"), "summary": case.get("summary"), "input": None, "events": []
        })
    safe["cases"] = cases
    # Validator guarantees replay is identical to a public Run case.
    return safe


def redact_hidden_error(error):
    if not isinstance(error, dict):
        return None
    kind = error.get("kind")
    return {"kind": kind, "message": HIDDEN_ERROR_MESSAGES.get(kind, "The code failed on a hidden case.")}


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("QUEST_CODER_RUNNER_TOKEN is required")
    load_private_pack()  # Fail closed before opening a socket.
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
