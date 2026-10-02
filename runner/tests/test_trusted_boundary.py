from __future__ import annotations

import json
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest import mock

from runner import quest_runner
from runner.service.app import redact_hidden_cases

ROOT = Path(__file__).resolve().parents[2]
PACK = json.loads((ROOT / "runner/packs/forest-of-patience-climbing-stairs.json").read_text())


class TrustedRunnerBoundaryTests(unittest.TestCase):
    def run_cli(self, source: str, challenge_id: str = "patience-last-jump", mode: str = "submit"):
        payload = {"source": source, "packSlug": PACK["slug"], "challengeId": challenge_id, "mode": mode}
        return subprocess.run([sys.executable, "runner/quest_runner_cli.py"], cwd=ROOT, input=json.dumps(payload), text=True, capture_output=True, timeout=10)

    def test_wrong_code_is_executed_not_inferred(self):
        result = self.run_cli("def count_routes(n):\n    return 999")
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertFalse(payload["passed"])
        self.assertEqual(payload["status"], "wrong_answer")

    def test_reference_solution_passes_hidden_submit_suite(self):
        quest = PACK["quests"][0]
        result = self.run_cli(quest["solution"]["code"], quest["id"])
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["passed"])
        self.assertGreater(len(payload["cases"]), len(quest["tests"]["run"]))

    def test_unknown_fields_and_traversal_are_rejected(self):
        payload = {"source": "pass", "packSlug": "../../etc/passwd", "challengeId": "x", "mode": "submit", "packPath": "/etc/passwd"}
        result = subprocess.run([sys.executable, "runner/quest_runner_cli.py"], cwd=ROOT, input=json.dumps(payload), text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown field", result.stderr)

    def test_every_reference_solution_passes_its_submit_suite(self):
        for challenge in [*PACK["quests"], PACK["boss"]]:
            with self.subTest(challenge=challenge["id"]):
                result = self.run_cli(challenge["solution"]["code"], challenge["id"])
                self.assertEqual(result.returncode, 0, result.stderr)
                payload = json.loads(result.stdout)
                self.assertTrue(payload["passed"], payload["status"])
                self.assertEqual(len(payload["cases"]), len(challenge["tests"]["submit"]))
                self.assertEqual(payload["replay"]["caseId"], challenge["tests"]["replayCaseId"])

    def test_run_mode_uses_only_the_basic_suite(self):
        boss = PACK["boss"]
        payload = json.loads(self.run_cli(boss["solution"]["code"], boss["id"], mode="run").stdout)
        self.assertEqual(payload["execution"]["mode"], "run")
        self.assertEqual(len(payload["cases"]), len(boss["tests"]["run"]))

    def test_worker_process_never_receives_expected_values(self):
        test = {"id": "secret-case", "input": {"n": 5}, "expected": 123456789}
        with mock.patch.object(quest_runner.subprocess, "run", wraps=quest_runner.subprocess.run) as spawn:
            case = quest_runner.run_one_case(
                "def count_routes(n):\n    return 8", test, entrypoint="count_routes", trace=True,
                budget_limit=None, timeout_ms=2000, max_events=100, isolate=True,
            )
        self.assertEqual(case["status"], "wrong_answer")
        self.assertEqual(case["actual"], 8)
        sent = json.loads(spawn.call_args.kwargs["input"])
        self.assertEqual(set(sent), {"source", "inputs", "entrypoint", "trace", "timeoutMs", "maxEvents"})
        self.assertNotIn("123456789", spawn.call_args.kwargs["input"])
        self.assertNotIn("secret-case", spawn.call_args.kwargs["input"])

    def test_non_terminating_submit_is_classified_within_the_service_deadline(self):
        started = time.monotonic()
        result = self.run_cli("class Solution:\n    def climbStairs(self, n):\n        while True:\n            pass", "boss-old-bramblehorn")
        elapsed = time.monotonic() - started
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["status"], "loop_guard")
        self.assertTrue(all(case["status"] == "loop_guard" for case in payload["cases"]))
        self.assertLess(elapsed, 6.5)

    def test_loop_guard_survives_a_catch_all_handler(self):
        source = "def count_routes(n):\n    while True:\n        try:\n            while True:\n                pass\n        except:\n            pass"
        payload = json.loads(self.run_cli(source, mode="run").stdout)
        self.assertEqual(payload["status"], "loop_guard")

    def test_hidden_case_errors_keep_the_kind_but_not_submitted_text(self):
        source = "def count_routes(n):\n    raise ValueError('leak-' + str(n))"
        raw = json.loads(self.run_cli(source).stdout)
        self.assertIn("leak-", raw["cases"][0]["error"]["message"])
        redacted = redact_hidden_cases(raw, "submit")
        for case in redacted["cases"]:
            self.assertEqual(case["error"]["kind"], "runtime_error")
            self.assertNotIn("leak-", json.dumps(case))
            self.assertIsNone(case["expected"])
            self.assertTrue(case["caseId"].startswith("hidden-"))

    def test_unusual_return_values_grade_as_wrong_answers_in_strict_json(self):
        def reject(name):
            raise AssertionError(f"runner emitted non-standard JSON constant {name}")

        for label, body in {"infinity": "float('inf')", "nan": "float('nan')", "huge integer": "10 ** 6000"}.items():
            with self.subTest(value=label):
                result = self.run_cli(f"def count_routes(n):\n    return {body}", mode="run")
                self.assertEqual(result.returncode, 0, result.stderr)
                payload = json.loads(result.stdout, parse_constant=reject)
                self.assertEqual(payload["status"], "wrong_answer")
                self.assertIsInstance(payload["cases"][0]["actual"], str)


if __name__ == "__main__":
    unittest.main()
