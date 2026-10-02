#!/usr/bin/env python3
"""Credential-protected Quest Coder runner gateway.

This service is a separate deployment boundary from Next.js. In production the
whole service must run in a locked-down container/microVM with networking denied
for the worker and provider-level CPU/memory/process limits.
"""
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
TOKEN = os.environ.get("QUEST_CODER_RUNNER_TOKEN", "")
HOST = os.environ.get("QUEST_CODER_RUNNER_HOST", "127.0.0.1")
PORT = int(os.environ.get("QUEST_CODER_RUNNER_PORT", "8787"))
MAX_BODY = 24_000 + 1024
MAX_OUTPUT = 1_000_000
# Backstop only: the CLI enforces its own 5.5s whole-submission deadline and
# returns a classified result before this fires.
TIMEOUT_SECONDS = 7
HIDDEN_ERROR_MESSAGES = {
    "compile_error": "The code did not compile.",
    "runtime_error": "The code raised an error on a hidden case.",
    "loop_guard": "The code did not finish in time on a hidden case.",
    "off_end_read": "The code read outside a list on a hidden case.",
}
ALLOWED_PACK = "forest-of-patience-climbing-stairs"
ALLOWED_CHALLENGES = {
    "patience-last-jump", "patience-route-scroll", "patience-two-slot-pouch", "boss-old-bramblehorn"
}
RUN_SLOTS = threading.BoundedSemaphore(value=2)

class Handler(BaseHTTPRequestHandler):
    server_version = "QuestCoderRunner/1"

    def do_GET(self):
        if self.path not in {"/healthz", "/readyz"}: return self.reply(404, {"error": "not found"})
        if self.path == "/readyz" and not self.authorized(): return self.reply(401, {"error": "unauthorized", "code": "unauthorized"})
        self.reply(200, {"status": "ok", "version": "runner-service-v1"})

    def do_POST(self):
        if self.path != "/v1/runs": return self.reply(404, {"error": "not found"})
        if not self.authorized(): return self.reply(401, {"error": "unauthorized", "code": "unauthorized"})
        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > MAX_BODY: return self.reply(413, {"error": "request too large", "code": "request_too_large"})
            payload = json.loads(self.rfile.read(length))
            validate(payload)
            if not RUN_SLOTS.acquire(blocking=False):
                return self.reply(429, {"error": "runner is busy; retry shortly", "code": "queue_full"})
            try:
                proc = subprocess.run(
                    [sys.executable, "runner/quest_runner_cli.py"],
                    cwd=ROOT,
                    input=json.dumps(payload), text=True, capture_output=True,
                    timeout=TIMEOUT_SECONDS, env=worker_env(),
                )
            finally:
                RUN_SLOTS.release()
            if len(proc.stdout.encode()) > MAX_OUTPUT: return self.reply(502, {"error": "runner response too large", "code": "response_too_large"})
            if proc.returncode != 0:
                message = safe_error(proc.stderr)
                return self.reply(422, {"error": message, "code": "runner_rejected"})
            result = json.loads(proc.stdout)
            self.reply(200, redact_hidden_cases(result, payload["mode"]))
        except subprocess.TimeoutExpired:
            self.reply(504, {"error": "Execution timed out. Check for an infinite loop.", "code": "runner_timeout"})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            self.reply(400, {"error": str(exc), "code": "invalid_request"})
        except Exception:
            self.reply(500, {"error": "runner service failed", "code": "runner_error"})

    def authorized(self):
        supplied = self.headers.get("authorization") or ""
        return bool(TOKEN) and hmac.compare_digest(supplied.encode(), f"Bearer {TOKEN}".encode())

    def reply(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status); self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body))); self.send_header("cache-control", "no-store")
        self.end_headers(); self.wfile.write(body)

    def log_message(self, format, *args):
        sys.stderr.write("runner-service: " + format % args + "\n")

def validate(payload):
    if not isinstance(payload, dict): raise ValueError("request body must be an object")
    allowed = {"source", "packSlug", "challengeId", "mode"}
    unknown = set(payload) - allowed
    if unknown: raise ValueError(f"unknown field: {sorted(unknown)[0]}")
    source = payload.get("source")
    if not isinstance(source, str) or not source.strip(): raise ValueError("source must be a non-empty Python string")
    if len(source.encode()) > 24_000: raise ValueError("source exceeds public limit")
    if payload.get("packSlug") != ALLOWED_PACK: raise ValueError("unknown pack")
    if payload.get("challengeId") not in ALLOWED_CHALLENGES: raise ValueError("unknown challenge")
    if payload.get("mode") not in {"run", "submit"}: raise ValueError("mode must be run or submit")

def worker_env():
    keep = {"PATH": os.environ.get("PATH", ""), "PYTHONPATH": str(ROOT), "PYTHONSAFEPATH": "1", "QUEST_CODER_PUBLIC_HARDENED": "1"}
    return keep

def safe_error(stderr):
    try: return json.loads(stderr).get("error", "runner rejected submission")
    except Exception: return "runner rejected submission"

def redact_hidden_cases(result, mode):
    if mode != "submit": return result
    safe = dict(result)
    cases = []
    for index, case in enumerate(result.get("cases", []), 1):
        cases.append({
            "caseId": f"hidden-{index}", "status": case.get("status"), "passed": case.get("passed"),
            "expected": None, "actual": None, "arguments": {}, "error": redact_hidden_error(case.get("error")),
            "budget": case.get("budget"), "summary": case.get("summary"), "input": None, "events": []
        })
    safe["cases"] = cases
    # Replay is a deliberately public visualization fixture, not a hidden submit row.
    return safe

def redact_hidden_error(error):
    """Error text is produced by submitted code, so it could echo hidden inputs. Keep only the kind."""
    if not isinstance(error, dict): return None
    kind = error.get("kind")
    return {"kind": kind, "message": HIDDEN_ERROR_MESSAGES.get(kind, "The code failed on a hidden case.")}

if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("QUEST_CODER_RUNNER_TOKEN is required")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
