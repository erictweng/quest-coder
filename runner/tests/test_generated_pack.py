"""The production pack generator: valid packs, correct oracle, and private cases that catch hard-coding."""
from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from runner.private_pack import load_private_pack  # noqa: E402
from scripts.private_pack import generated_pack, ways  # noqa: E402

SERVER_PACK = json.loads((ROOT / "content/server/forest-of-patience-climbing-stairs.json").read_text())
SOLUTIONS = {item["id"]: item["solution"]["code"] for item in [*SERVER_PACK["quests"], SERVER_PACK["boss"]]}


class GeneratedPrivatePackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.path = Path(cls.tmp.name) / "pack.json"
        result = subprocess.run([sys.executable, "scripts/private_pack.py", "generate-cases", str(cls.path)], cwd=ROOT, capture_output=True, text=True, timeout=30)
        assert result.returncode == 0, result.stderr
        cls.cli_output = result.stdout
        cls.pack = json.loads(cls.path.read_text())

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def run_cli(self, source: str, challenge_id: str, mode: str = "submit"):
        env = {**os.environ, "QUEST_CODER_PRIVATE_PACK_PATH": str(self.path)}
        payload = {"source": source, "packSlug": self.pack["slug"], "challengeId": challenge_id, "mode": mode}
        result = subprocess.run([sys.executable, "runner/quest_runner_cli.py"], cwd=ROOT, env=env, input=json.dumps(payload), text=True, capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_oracle_matches_known_route_counts(self):
        self.assertEqual([ways(n) for n in range(8)], [1, 1, 2, 3, 5, 8, 13, 21])
        self.assertEqual(ways(45), 1836311903)

    def test_pack_is_valid_owner_only_and_never_printed(self):
        load_private_pack(self.path)
        self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o600)
        # No case data (JSON objects/arrays or large answers) appears in the CLI output.
        self.assertNotIn("{", self.cli_output)
        self.assertNotIn("[", self.cli_output)
        self.assertNotIn(str(ways(45)), self.cli_output)
        self.assertIn("contents not printed", self.cli_output)

    def test_run_suite_is_public_and_submit_adds_new_private_cases(self):
        public = {item["id"]: item["tests"]["run"] for item in [*SERVER_PACK["quests"], SERVER_PACK["boss"]]}
        for challenge in self.pack["challenges"]:
            tests = challenge["tests"]
            self.assertEqual(tests["run"], public[challenge["id"]])
            private = tests["submit"][len(tests["run"]):]
            self.assertEqual(len(private), 8, challenge["id"])
            public_inputs = [case["input"] for case in tests["run"]]
            self.assertTrue(all(case["input"] not in public_inputs for case in private))
            self.assertIn(tests["replayCaseId"], {case["id"] for case in tests["run"]})

    def test_private_cases_respect_quest_constraints(self):
        by_id = {c["id"]: c["tests"]["submit"] for c in self.pack["challenges"]}
        self.assertTrue(all(1 <= case["input"]["n"] <= 10 for case in by_id["patience-last-jump"]))
        for challenge_id in ("patience-route-scroll", "boss-old-bramblehorn"):
            self.assertTrue(all(1 <= case["input"]["n"] <= 45 for case in by_id[challenge_id]))

    def test_every_reference_solution_passes_the_generated_pack(self):
        for challenge_id, source in SOLUTIONS.items():
            with self.subTest(challenge_id):
                payload = self.run_cli(source, challenge_id)
                self.assertTrue(payload["passed"], payload.get("status"))

    def test_hard_coding_the_public_examples_fails_submit(self):
        hardcoded = "class Solution:\n    def climbStairs(self, n: int) -> int:\n        return {2: 2, 5: 8}.get(n, 0)\n"
        self.assertTrue(self.run_cli(hardcoded, "boss-old-bramblehorn", mode="run")["passed"])
        self.assertFalse(self.run_cli(hardcoded, "boss-old-bramblehorn")["passed"])

    def test_generator_refuses_to_overwrite(self):
        result = subprocess.run([sys.executable, "scripts/private_pack.py", "generate-cases", str(self.path)], cwd=ROOT, capture_output=True, text=True, timeout=30)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("refusing to overwrite", result.stderr)

    def test_each_generation_draws_different_private_ids(self):
        other = generated_pack()
        ids = lambda pack: {case["id"] for c in pack["challenges"] for case in c["tests"]["submit"][len(c["tests"]["run"]):]}
        self.assertFalse(ids(self.pack) & ids(other))


if __name__ == "__main__":
    unittest.main()
