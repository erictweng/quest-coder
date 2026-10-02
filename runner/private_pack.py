"""Loading and structural validation for mounted private grading packs."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

PRIVATE_PACK_ENV = "QUEST_CODER_PRIVATE_PACK_PATH"
MAX_PRIVATE_PACK_BYTES = 5_000_000
ALLOWED_PACK_SLUG = "forest-of-patience-climbing-stairs"
ALLOWED_CHALLENGE_IDS = {
    "patience-last-jump",
    "patience-route-scroll",
    "patience-two-slot-pouch",
    "boss-old-bramblehorn",
}


class PrivatePackError(ValueError):
    pass


def private_pack_path() -> Path:
    raw = os.environ.get(PRIVATE_PACK_ENV, "").strip()
    if not raw:
        raise PrivatePackError(f"{PRIVATE_PACK_ENV} is required")
    path = Path(raw)
    if not path.is_absolute():
        raise PrivatePackError(f"{PRIVATE_PACK_ENV} must be an absolute path")
    return path


def load_private_pack(path: Path | None = None) -> dict[str, Any]:
    path = path or private_pack_path()
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise PrivatePackError("private pack is not readable") from exc
    if size <= 0 or size > MAX_PRIVATE_PACK_BYTES:
        raise PrivatePackError("private pack has an invalid size")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PrivatePackError("private pack is not valid UTF-8 JSON") from exc
    return validate_private_pack(raw)


def validate_private_pack(pack: Any) -> dict[str, Any]:
    if not isinstance(pack, dict):
        raise PrivatePackError("private pack must be a JSON object")
    if pack.get("schemaVersion") != "quest-private-pack.v1":
        raise PrivatePackError("private pack schemaVersion must be quest-private-pack.v1")
    if pack.get("slug") != ALLOWED_PACK_SLUG:
        raise PrivatePackError("private pack slug is not allowed")
    runtime = pack.get("runtime")
    if not isinstance(runtime, dict):
        raise PrivatePackError("private pack runtime is required")
    for key in ("timeLimitMs", "timelineEventCap"):
        value = runtime.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
            raise PrivatePackError(f"private pack runtime.{key} must be a positive integer")
    found: dict[str, dict[str, Any]] = {}
    entries = pack.get("challenges")
    if not isinstance(entries, list):
        raise PrivatePackError("private pack challenges must be an array")
    for challenge in entries:
        if not isinstance(challenge, dict):
            raise PrivatePackError("private pack challenge must be an object")
        challenge_id = challenge.get("id")
        if challenge_id not in ALLOWED_CHALLENGE_IDS or challenge_id in found:
            raise PrivatePackError("private pack has an unknown or duplicate challenge")
        entrypoint = challenge.get("entrypoint")
        if not isinstance(entrypoint, str) or not entrypoint:
            raise PrivatePackError(f"private pack challenge {challenge_id} needs an entrypoint")
        tests = challenge.get("tests")
        if not isinstance(tests, dict):
            raise PrivatePackError(f"private pack challenge {challenge_id} needs tests")
        for mode in ("run", "submit"):
            cases = tests.get(mode)
            if not isinstance(cases, list) or not cases:
                raise PrivatePackError(f"private pack challenge {challenge_id} needs non-empty {mode} tests")
            _validate_cases(challenge_id, mode, cases)
        replay_case_id = tests.get("replayCaseId")
        submit_ids = {case["id"] for case in tests["submit"]}
        if not isinstance(replay_case_id, str) or replay_case_id not in submit_ids:
            raise PrivatePackError(f"private pack challenge {challenge_id} replayCaseId must name a submit test")
        run_by_id = {case["id"]: case for case in tests["run"]}
        submit_by_id = {case["id"]: case for case in tests["submit"]}
        if replay_case_id not in run_by_id or run_by_id[replay_case_id] != submit_by_id[replay_case_id]:
            raise PrivatePackError(f"private pack challenge {challenge_id} replayCaseId must name an identical public run case")
        budget = challenge.get("budget", {})
        if not isinstance(budget, dict):
            raise PrivatePackError(f"private pack challenge {challenge_id} budget must be an object")
        found[challenge_id] = challenge
    if set(found) != ALLOWED_CHALLENGE_IDS:
        raise PrivatePackError("private pack must define every allowed challenge exactly once")
    return pack


def _validate_cases(challenge_id: str, mode: str, cases: list[Any]) -> None:
    seen: set[str] = set()
    for case in cases:
        if not isinstance(case, dict) or set(case) != {"id", "input", "expected"}:
            raise PrivatePackError(f"{challenge_id} {mode} tests require only id, input, and expected")
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id or case_id in seen:
            raise PrivatePackError(f"{challenge_id} {mode} tests need unique non-empty ids")
        if not isinstance(case.get("input"), dict):
            raise PrivatePackError(f"{challenge_id} {mode} test inputs must be objects")
        seen.add(case_id)
