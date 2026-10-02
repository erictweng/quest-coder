from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from runner import quest_runner
from runner.private_pack import PrivatePackError, load_private_pack
from runner.service.app import redact_hidden_cases
from runner.service.request_body import RequestBodyTooLarge, read_bounded_body

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = ROOT / "runner/tests/fixtures/non-production-private-pack.json"
PACK = json.loads(FIXTURE_PATH.read_text())
SERVER_PACK = json.loads((ROOT / "content/server/forest-of-patience-climbing-stairs.json").read_text())
SOLUTIONS = {item["id"]: item["solution"]["code"] for item in [*SERVER_PACK["quests"], SERVER_PACK["boss"]]}
CHALLENGES = {item["id"]: item for item in PACK["challenges"]}


class TrustedRunnerBoundaryTests(unittest.TestCase):
    def run_cli(self, source: str, challenge_id: str = "patience-last-jump", mode: str = "submit", *, pack_path: Path | None = FIXTURE_PATH):
        payload = {"source": source, "packSlug": PACK["slug"], "challengeId": challenge_id, "mode": mode}
        env = os.environ.copy()
        if pack_path is None:
            env.pop("QUEST_CODER_PRIVATE_PACK_PATH", None)
        else:
            env["QUEST_CODER_PRIVATE_PACK_PATH"] = str(pack_path.resolve())
        return subprocess.run([sys.executable, "runner/quest_runner_cli.py"], cwd=ROOT, env=env, input=json.dumps(payload), text=True, capture_output=True, timeout=10)

    def test_missing_private_pack_fails_closed(self):
        result = self.run_cli("def count_routes(n):\n    return 1", pack_path=None)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("QUEST_CODER_PRIVATE_PACK_PATH is required", result.stderr)

    def test_invalid_private_pack_fails_closed(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            handle.write('{"schemaVersion":"wrong"}')
            path = Path(handle.name)
        try:
            result = self.run_cli("def count_routes(n):\n    return 1", pack_path=path)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("schemaVersion", result.stderr)
            with self.assertRaises(PrivatePackError):
                load_private_pack(path)
        finally:
            path.unlink()

    def test_wrong_code_is_executed_not_inferred(self):
        result = self.run_cli("def count_routes(n):\n    return 999")
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertFalse(payload["passed"])
        self.assertEqual(payload["status"], "wrong_answer")

    def test_every_server_reference_solution_passes_injected_nonproduction_fixture(self):
        for challenge_id, challenge in CHALLENGES.items():
            with self.subTest(challenge=challenge_id):
                result = self.run_cli(SOLUTIONS[challenge_id], challenge_id)
                self.assertEqual(result.returncode, 0, result.stderr)
                payload = json.loads(result.stdout)
                self.assertTrue(payload["passed"], payload["status"])
                self.assertEqual(len(payload["cases"]), len(challenge["tests"]["submit"]))
                self.assertEqual(payload["replay"]["caseId"], challenge["tests"]["replayCaseId"])

    def test_unknown_fields_and_traversal_are_rejected(self):
        payload = {"source": "pass", "packSlug": "../../etc/passwd", "challengeId": "x", "mode": "submit", "packPath": "/etc/passwd"}
        result = subprocess.run([sys.executable, "runner/quest_runner_cli.py"], cwd=ROOT, input=json.dumps(payload), text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown field", result.stderr)

    def test_run_mode_uses_only_the_basic_suite(self):
        boss = CHALLENGES["boss-old-bramblehorn"]
        payload = json.loads(self.run_cli(SOLUTIONS[boss["id"]], boss["id"], mode="run").stdout)
        self.assertEqual(payload["execution"]["mode"], "run")
        self.assertEqual(len(payload["cases"]), len(boss["tests"]["run"]))

    def test_worker_process_never_receives_expected_values(self):
        test = {"id": "secret-case", "input": {"n": 5}, "expected": 123456789}
        with mock.patch.object(quest_runner, "run_bounded", wraps=quest_runner.run_bounded) as spawn:
            case = quest_runner.run_one_case(
                "def count_routes(n):\n    return 8", test, entrypoint="count_routes", trace=True,
                budget_limit=None, timeout_ms=2000, max_events=100, isolate=True,
            )
        self.assertEqual(case["status"], "wrong_answer")
        sent = json.loads(spawn.call_args.kwargs["input_bytes"])
        self.assertEqual(set(sent), {"source", "inputs", "entrypoint", "trace", "timeoutMs", "maxEvents"})
        self.assertNotIn("123456789", spawn.call_args.kwargs["input_bytes"].decode())
        self.assertNotIn("secret-case", spawn.call_args.kwargs["input_bytes"].decode())

    def test_oversized_worker_output_is_stopped_and_classified(self):
        result = self.run_cli("def count_routes(n):\n    return 'x' * 3000000", mode="run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "runtime_error")

    def test_non_terminating_submit_is_classified_within_the_service_deadline(self):
        started = time.monotonic()
        result = self.run_cli("class Solution:\n    def climbStairs(self, n):\n        while True:\n            pass", "boss-old-bramblehorn")
        elapsed = time.monotonic() - started
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["status"], "loop_guard")
        self.assertLess(elapsed, 6.5)

    def test_hidden_case_errors_keep_the_kind_but_not_submitted_text(self):
        raw = json.loads(self.run_cli("def count_routes(n):\n    raise ValueError('leak-' + str(n))").stdout)
        redacted = redact_hidden_cases(raw, "submit")
        for case in redacted["cases"]:
            self.assertEqual(case["error"]["kind"], "runtime_error")
            self.assertNotIn("leak-", json.dumps(case))
            self.assertIsNone(case["expected"])

    def test_chunked_request_reader_caps_before_buffering(self):
        body = io.BytesIO(b"3\r\n{\"a\r\n4\r\n\":1}\r\n0\r\n\r\n")
        self.assertEqual(read_bounded_body(body, {"transfer-encoding": "chunked"}, 8), b'{"a":1}')
        oversized = io.BytesIO(b"9\r\n123456789\r\n0\r\n\r\n")
        with self.assertRaises(RequestBodyTooLarge):
            read_bounded_body(oversized, {"transfer-encoding": "chunked"}, 8)


if __name__ == "__main__":
    unittest.main()
