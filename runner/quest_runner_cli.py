from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runner.private_pack import ALLOWED_PACK_SLUG, load_private_pack
from runner.quest_runner import default_rotated_budget, run_submission

ALLOWED_FIELDS = {"source", "packSlug", "challengeId", "mode"}
ALLOWED_MODES = {"run", "submit"}

# Whole-submission deadline. Must stay below the gateway's worker timeout so a
# non-terminating submission comes back classified instead of as a gateway 504.
TOTAL_BUDGET_MS = 5_500


def budget_limit(challenge: dict[str, Any], tests: list[dict[str, Any]]) -> int | None:
    budget = challenge.get("budget", {})
    if not budget.get("enabled"):
        return None
    if "absoluteLimit" in budget:
        return int(budget["absoluteLimit"])
    max_n = max((len(test.get("input", {}).get("nums", [])) for test in tests), default=1)
    return default_rotated_budget(max_n)


def challenge_from_pack(pack: dict[str, Any], challenge_id: str) -> dict[str, Any]:
    for challenge in pack["challenges"]:
        if challenge["id"] == challenge_id:
            return challenge
    raise ValueError("unknown challenge")


def load_pack_challenge(pack_slug: str, challenge_id: str, mode: str) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]], dict[str, Any] | None]:
    if pack_slug != ALLOWED_PACK_SLUG:
        raise ValueError("unknown pack")
    pack = load_private_pack()
    challenge = challenge_from_pack(pack, challenge_id)
    test_spec = challenge["tests"]
    tests = list(test_spec[mode])
    replay_case_id = test_spec["replayCaseId"]
    replay_test = next((test for test in test_spec["submit"] if test["id"] == replay_case_id), None)
    return pack, challenge, tests, replay_test


def parse_payload(payload: Any) -> tuple[str, str, str, str]:
    if not isinstance(payload, dict):
        raise ValueError("request must be an object")
    unknown = set(payload) - ALLOWED_FIELDS
    if unknown:
        raise ValueError(f"unknown field: {sorted(unknown)[0]}")
    if set(payload) != ALLOWED_FIELDS:
        raise ValueError("source, packSlug, challengeId, and mode are required")
    source = payload["source"]
    pack_slug = payload["packSlug"]
    challenge_id = payload["challengeId"]
    mode = payload["mode"]
    if not isinstance(source, str) or not source.strip():
        raise ValueError("source must be a non-empty string")
    if pack_slug != ALLOWED_PACK_SLUG:
        raise ValueError("unknown pack")
    if not isinstance(challenge_id, str):
        raise ValueError("unknown challenge")
    if mode not in ALLOWED_MODES:
        raise ValueError("mode must be run or submit")
    return source, pack_slug, challenge_id, mode


def main() -> int:
    try:
        source, pack_slug, challenge_id, mode = parse_payload(json.load(sys.stdin))
        pack, challenge, tests, replay_test = load_pack_challenge(pack_slug, challenge_id, mode)
        result = run_submission(
            source,
            tests,
            quest_id=challenge["id"],
            entrypoint=challenge["entrypoint"],
            budget_limit=budget_limit(challenge, tests),
            timeout_ms=int(pack["runtime"]["timeLimitMs"]),
            max_events=int(pack["runtime"]["timelineEventCap"]),
            mode=mode,
            replay_test=replay_test,
            isolate=True,
            total_budget_ms=TOTAL_BUDGET_MS,
        )
        print(json.dumps(result, allow_nan=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": f"{type(exc).__name__}: {exc}"}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
