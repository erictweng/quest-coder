from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from runner.quest_runner import run_submission


def default_tests() -> list[dict[str, Any]]:
    return [
        {"id": "small-found", "input": {"nums": [4, 5, 6, 7, 0, 1, 2], "target": 0}, "expected": 4},
        {"id": "small-missing", "input": {"nums": [4, 5, 6, 7, 0, 1, 2], "target": 3}, "expected": -1},
        {"id": "large-found", "input": {"nums": list(range(96, 256)) + list(range(96)), "target": 95}, "expected": 255},
    ]


def default_rotated_budget(n: int) -> int:
    return 4 * math.ceil(math.log2(n + 1)) + 16


def budget_limit(challenge: dict[str, Any], tests: list[dict[str, Any]]) -> int | None:
    budget = challenge.get("budget", {})
    if not budget.get("enabled"):
        return None
    if "absoluteLimit" in budget:
        return int(budget["absoluteLimit"])
    max_n = max((len(test.get("input", {}).get("nums", [])) for test in tests), default=1)
    return default_rotated_budget(max_n)


def challenge_from_pack(pack: dict[str, Any], challenge_id: str) -> dict[str, Any]:
    for challenge in [*pack.get("quests", []), pack.get("boss")]:
        if isinstance(challenge, dict) and challenge.get("id") == challenge_id:
            return challenge
    raise ValueError(f"challenge not found: {challenge_id}")


def load_pack_challenge(pack_path: str, challenge_id: str, mode: str = "submit") -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]], dict[str, Any] | None]:
    pack = json.loads(Path(pack_path).read_text())
    challenge = challenge_from_pack(pack, challenge_id)
    test_spec = challenge.get("tests", {})
    suite_name = "submit" if mode == "submit" else "run"
    tests = list(test_spec.get(suite_name) or test_spec.get("fixed", []))
    if not tests:
        raise ValueError(f"challenge has no {suite_name} tests: {challenge_id}")
    replay_case_id = test_spec.get("replayCaseId") or next(iter(test_spec.get("replayCaseIds", [])), None)
    all_tests = list(test_spec.get("submit") or test_spec.get("fixed", []))
    replay_test = next((test for test in all_tests if test.get("id") == replay_case_id), None)
    return pack, challenge, tests, replay_test


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        source = payload["source"]
        if not isinstance(source, str) or not source.strip():
            raise ValueError("source must be a non-empty string")

        if "packPath" in payload or "challengeId" in payload:
            mode = str(payload.get("mode", "submit"))
            if mode not in {"run", "submit"}:
                mode = "run"
            pack, challenge, tests, replay_test = load_pack_challenge(
                str(payload.get("packPath", "content/packs/forest-of-patience-climbing-stairs.json")),
                str(payload.get("challengeId", "boss-old-bramblehorn")),
                mode,
            )
            timeout_ms = int(pack.get("runtime", {}).get("timeLimitMs", 2000))
            max_events = int(pack.get("runtime", {}).get("timelineEventCap", 3000))
            quest_id = challenge["id"]
            entrypoint = challenge["entrypoint"]
            limit = budget_limit(challenge, tests)
        else:
            tests = default_tests()
            replay_test = tests[0]
            mode = "submit"
            timeout_ms = 2000
            max_events = 3000
            quest_id = "timequake-search-rotated-array"
            entrypoint = "Solution().search"
            limit = default_rotated_budget(256)

        result = run_submission(
            source,
            tests,
            quest_id=quest_id,
            entrypoint=entrypoint,
            budget_limit=limit,
            timeout_ms=timeout_ms,
            max_events=max_events,
            mode=mode,
            replay_test=replay_test,
        )
        print(json.dumps(result))
        return 0
    except Exception as exc:  # noqa: BLE001 - command-line bridge should emit safe failure JSON.
        print(json.dumps({"error": f"{type(exc).__name__}: {exc}"}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
