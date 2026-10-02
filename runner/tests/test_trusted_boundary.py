from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
