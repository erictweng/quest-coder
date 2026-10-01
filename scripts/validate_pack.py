from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path
from typing import Any, NoReturn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from runner.quest_runner import run_submission

REQUIRED_OUTCOMES = ["passed", "wrong_answer", "compile_error", "runtime_error", "over_budget", "loop_guard", "off_end_read"]

LINEAR_SEARCH = """
class Solution:
    def search(self, nums: List[int], target: int) -> int:
        for i, value in enumerate(nums):
            if value == target:
                return i
        return -1
"""


def fail(message: str) -> NoReturn:
    raise ValueError(message)


def budget_limit(challenge: dict[str, Any], tests: list[dict[str, Any]]) -> int | None:
    budget = challenge.get("budget", {})
    if not budget.get("enabled"):
        return None
    if "absoluteLimit" in budget:
        return int(budget["absoluteLimit"])
    max_n = max((len(test.get("input", {}).get("nums", [])) for test in tests), default=1)
    return 4 * math.ceil(math.log2(max_n + 1)) + 16


def rotated(size: int, pivot: int) -> list[int]:
    values = list(range(size))
    return values[pivot:] + values[:pivot]


def generated_tests(challenge: dict[str, Any]) -> list[dict[str, Any]]:
    spec = challenge.get("tests", {}).get("random")
    if not spec:
        return []
    rng = random.Random(str(spec.get("seed", challenge["id"])))
    lo, hi = spec.get("sizeRange", [16, 64])
    tests: list[dict[str, Any]] = []
    for index in range(int(spec.get("count", 0))):
        size = rng.randint(int(lo), int(hi))
        generator = spec.get("generator")
        nums: list[int]
        target: int | None
        expected: int | str
        if generator == "sorted-array-target-or-missing":
            nums = list(range(size))
            present = index % 2 == 0
            target = rng.choice(nums) if present else size + rng.randint(1, 50)
            expected = nums.index(target) if present else -1
        elif generator == "rotated-array-pivot":
            pivot = rng.randint(0, size - 1)
            nums = rotated(size, pivot)
            target = None
            expected = 0 if pivot == 0 else size - pivot
            tests.append({"id": f"{challenge['id']}-generated-{index}", "name": "generated pivot", "input": {"nums": nums}, "expected": expected})
            continue
        elif generator == "rotated-array-target-or-missing":
            pivot = rng.randint(0, size - 1)
            nums = rotated(size, pivot)
            present = index % 2 == 0
            target = rng.choice(nums) if present else size + rng.randint(1, 50)
            expected = nums.index(target) if present else -1
        else:
            fail(f"unknown random generator {generator!r} in {challenge['id']}")
        tests.append({"id": f"{challenge['id']}-generated-{index}", "name": "generated", "input": {"nums": nums, "target": target}, "expected": expected})
    return tests


def all_tests(challenge: dict[str, Any]) -> list[dict[str, Any]]:
    tests = list(challenge.get("tests", {}).get("fixed", []))
    tests.extend(generated_tests(challenge))
    return tests


def all_challenges(pack: dict[str, Any]) -> list[dict[str, Any]]:
    return list(pack.get("quests", [])) + [pack.get("boss", {})]


def validate_shape(pack: dict[str, Any]) -> None:
    for key in ["schemaVersion", "id", "slug", "title", "metadata", "story", "runtime", "scene", "quests", "boss", "review", "rewards", "validation"]:
        if key not in pack:
            fail(f"missing top-level field: {key}")
    if pack["schemaVersion"] != "quest-pack.v0":
        fail("unsupported schemaVersion")
    if not (2 <= len(pack["quests"]) <= 8):
        fail("quest count must be 2-8")
    if not pack["metadata"].get("originalTextConfirmed"):
        fail("metadata.originalTextConfirmed must be true")
    checklist = pack.get("validation", {}).get("originalTextChecklist", {})
    for key in ["noCopiedProblemStatement", "originalStory", "noRealGameCharactersArtLogosMapsOrUi"]:
        if checklist.get(key) is not True:
            fail(f"original text checklist failed: {key}")
    scene_obj = pack.get("scene")
    if not isinstance(scene_obj, dict) or not scene_obj.get("renderer"):
        fail("missing scene spec")
    visuals = scene_obj.get("outcomeVisuals", {})
    for status in REQUIRED_OUTCOMES:
        if status not in visuals:
            fail(f"missing outcome visual: {status}")
    ids: set[str] = set()
    for challenge in all_challenges(pack):
        cid = challenge.get("id")
        if not cid or cid in ids:
            fail(f"missing or duplicate challenge id: {cid}")
        ids.add(cid)
        if not challenge.get("entrypoint"):
            fail(f"{cid} missing entrypoint")
        if not challenge.get("solution", {}).get("code"):
            fail(f"{cid} missing reference solution")
        tests = all_tests(challenge)
        if not tests:
            fail(f"{cid} has no tests")
        fixed_ids = {test.get("id") for test in challenge.get("tests", {}).get("fixed", [])}
        for replay_id in challenge.get("tests", {}).get("replayCaseIds", []):
            if replay_id not in fixed_ids:
                fail(f"{cid} replayCaseId {replay_id!r} is not a fixed test id")


def validate_references(pack: dict[str, Any]) -> dict[str, str]:
    statuses: dict[str, str] = {}
    for challenge in all_challenges(pack):
        tests = all_tests(challenge)
        result = run_submission(
            challenge["solution"]["code"],
            tests,
            quest_id=challenge["id"],
            entrypoint=challenge["entrypoint"],
            budget_limit=budget_limit(challenge, tests),
            timeout_ms=int(pack["runtime"].get("timeLimitMs", 2000)),
            max_events=int(pack["runtime"].get("timelineEventCap", 3000)),
        )
        statuses[challenge["id"]] = result["status"]
        if result["status"] != "passed":
            fail(f"reference solution failed for {challenge['id']}: {result['status']}")
        replay = result.get("replay") or {}
        kinds = {event.get("kind") for event in replay.get("events", [])}
        if "line" not in kinds or "outcome" not in kinds:
            fail(f"scene smoke failed for {challenge['id']}: timeline lacks line/outcome events")
        if pack["scene"]["type"] in {"array", "linked_list"} and "read" not in kinds:
            fail(f"scene smoke failed for {challenge['id']}: replay lacks reads")
    return statuses


def validate_linear_scan_trap(pack: dict[str, Any]) -> None:
    boss = pack["boss"]
    if not pack.get("validation", {}).get("linearScanShouldFailBudget"):
        return
    tests = all_tests(boss)
    result = run_submission(
        LINEAR_SEARCH,
        tests,
        quest_id=boss["id"],
        entrypoint=boss["entrypoint"],
        budget_limit=budget_limit(boss, tests),
        timeout_ms=int(pack["runtime"].get("timeLimitMs", 2000)),
        max_events=int(pack["runtime"].get("timelineEventCap", 3000)),
    )
    if result["status"] != "over_budget":
        fail(f"linear scan trap should fail budget, got {result['status']}")


def validate_pack(path: Path) -> dict[str, Any]:
    pack = json.loads(path.read_text())
    validate_shape(pack)
    statuses = validate_references(pack)
    validate_linear_scan_trap(pack)
    return {"pack": pack["id"], "status": "validated", "references": statuses, "challengeCount": len(all_challenges(pack))}


def main() -> int:
    try:
        path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("content/packs/timequake-search-rotated-array.json")
        print(json.dumps(validate_pack(path), indent=2))
        return 0
    except Exception as exc:  # noqa: BLE001 - validator CLI should return readable failures.
        print(f"validation failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
