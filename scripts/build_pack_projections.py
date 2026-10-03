#!/usr/bin/env python3
"""Generate browser-safe projections from tracked server content.

`content/server/<slug>.json` is the tracked source for public content. It keeps
server-released solution and hint text plus public Run/replay cases, but never
contains private Submit fixtures. `content/public/<slug>.json` removes solution
and hint text before browser bundling.

Private grading packs are mounted only by the runner and are deliberately not an
input to this script. Run with `--check` to fail when public projections are stale.
"""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT / "content" / "server"
PUBLIC_DIR = ROOT / "content" / "public"
PRIVATE_TEST_KEYS = ("submit", "fixed", "replayCaseIds", "random")


def challenges(pack: dict[str, Any]) -> list[dict[str, Any]]:
    return [*pack.get("quests", []), pack["boss"]]


def validate_server_source(pack: dict[str, Any], source: Path) -> None:
    for challenge in challenges(pack):
        tests = challenge.get("tests", {})
        leaked = [key for key in PRIVATE_TEST_KEYS if key in tests]
        if leaked:
            raise ValueError(f"{source.relative_to(ROOT)} contains private test keys: {', '.join(leaked)}")
    for variant in pack.get("review", {}).get("variants", []):
        if "tests" in variant:
            raise ValueError(f"{source.relative_to(ROOT)} contains private review tests")


def public_projection(pack: dict[str, Any]) -> dict[str, Any]:
    projected = copy.deepcopy(pack)
    for challenge in challenges(projected):
        challenge.pop("solution", None)
        challenge["hints"] = [{key: value for key, value in hint.items() if key != "text"} for hint in challenge.get("hints", [])]
    return projected


def render(pack: dict[str, Any]) -> str:
    return json.dumps(pack, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    check = "--check" in sys.argv[1:]
    stale: list[str] = []
    sources = sorted(SERVER_DIR.glob("*.json"))
    expected_names = {source.name for source in sources}
    for source in sources:
        pack = json.loads(source.read_text())
        validate_server_source(pack, source)
        target = PUBLIC_DIR / source.name
        expected = render(public_projection(pack))
        if target.exists() and target.read_text() == expected:
            continue
        if check:
            stale.append(str(target.relative_to(ROOT)))
        else:
            PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
            target.write_text(expected)
            print(f"wrote {target.relative_to(ROOT)}")
    extras = sorted(path for path in PUBLIC_DIR.glob("*.json") if path.name not in expected_names)
    if extras:
        if check:
            stale.extend(str(path.relative_to(ROOT)) for path in extras)
        else:
            for path in extras:
                path.unlink()
                print(f"removed {path.relative_to(ROOT)}")
    if stale:
        print("stale public pack projections (run scripts/build_pack_projections.py): " + ", ".join(stale), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
