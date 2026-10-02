#!/usr/bin/env python3
"""Generate a case-free private-pack skeleton or validate a completed pack."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runner.private_pack import load_private_pack

SERVER_PACK = ROOT / "content/server/forest-of-patience-climbing-stairs.json"


def skeleton() -> dict:
    public_server = json.loads(SERVER_PACK.read_text())
    challenges = [*public_server["quests"], public_server["boss"]]
    return {
        "schemaVersion": "quest-private-pack.v1",
        "slug": public_server["slug"],
        "runtime": {
            "timeLimitMs": public_server["runtime"]["timeLimitMs"],
            "timelineEventCap": public_server["runtime"]["timelineEventCap"],
        },
        "challenges": [
            {
                "id": challenge["id"],
                "entrypoint": challenge["entrypoint"],
                "budget": challenge.get("budget", {}),
                "tests": {"run": [], "submit": [], "replayCaseId": "REPLACE_WITH_A_PRIVATE_SUBMIT_CASE_ID"},
            }
            for challenge in challenges
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    generate = sub.add_parser("generate", help="write a case-free skeleton; add rotated private cases out of band")
    generate.add_argument("path", type=Path)
    validate = sub.add_parser("validate", help="validate a completed private pack")
    validate.add_argument("path", type=Path)
    args = parser.parse_args()

    if args.command == "generate":
        path = args.path.expanduser().resolve()
        if path.exists():
            raise SystemExit(f"refusing to overwrite {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(skeleton(), indent=2) + "\n")
        print(f"wrote case-free skeleton to {path}")
        return 0

    load_private_pack(args.path.expanduser().resolve())
    print("private pack is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
