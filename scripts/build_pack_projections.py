#!/usr/bin/env python3
"""Generate the Next.js projections of each runner pack.

`runner/packs/<slug>.json` is the single source of truth and the only place
hidden submit tests live. Two projections are derived from it:

- `content/server/<slug>.json`: read by the Next.js server. Hidden tests are
  removed; solutions and hint text stay so the server can reveal them.
- `content/public/<slug>.json`: bundled into the browser. Additionally drops
  solutions and hint text, which the server hands out on request.

Run with `--check` to fail when the committed projections are stale.
"""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "runner" / "packs"
SERVER_DIR = ROOT / "content" / "server"
PUBLIC_DIR = ROOT / "content" / "public"
HIDDEN_TEST_KEYS = ("submit", "fixed", "replayCaseIds", "random")


def challenges(pack: dict[str, Any]) -> list[dict[str, Any]]:
    return [*pack.get("quests", []), pack["boss"]]


def server_projection(pack: dict[str, Any]) -> dict[str, Any]:
    projected = copy.deepcopy(pack)
    for challenge in challenges(projected):
        for key in HIDDEN_TEST_KEYS:
            challenge.get("tests", {}).pop(key, None)
    for variant in projected.get("review", {}).get("variants", []):
        variant.pop("tests", None)
    return projected


def public_projection(pack: dict[str, Any]) -> dict[str, Any]:
    projected = server_projection(pack)
    for challenge in challenges(projected):
        challenge.pop("solution", None)
        challenge["hints"] = [{key: value for key, value in hint.items() if key != "text"} for hint in challenge.get("hints", [])]
    return projected


def render(pack: dict[str, Any]) -> str:
    return json.dumps(pack, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    check = "--check" in sys.argv[1:]
    stale: list[str] = []
    for source in sorted(SOURCE_DIR.glob("*.json")):
        pack = json.loads(source.read_text())
        for directory, projection in ((SERVER_DIR, server_projection), (PUBLIC_DIR, public_projection)):
            target = directory / source.name
            expected = render(projection(pack))
            if target.exists() and target.read_text() == expected:
                continue
            if check:
                stale.append(str(target.relative_to(ROOT)))
            else:
                directory.mkdir(parents=True, exist_ok=True)
                target.write_text(expected)
                print(f"wrote {target.relative_to(ROOT)}")
    if stale:
        print("stale pack projections (run scripts/build_pack_projections.py): " + ", ".join(stale), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
