#!/usr/bin/env python3
"""Generate a private grading pack (skeleton or with fresh hidden cases) or validate one."""
from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runner.private_pack import load_private_pack, validate_private_pack

SERVER_PACK = ROOT / "content/server/forest-of-patience-climbing-stairs.json"
HIDDEN_CASES_PER_CHALLENGE = 8


def ways(n: int) -> int:
    """Routes to ledge n with 1- and 2-ledge moves. Independent oracle; does not run the reference solutions."""
    a, b = 1, 1
    for _ in range(n - 1 if n > 0 else 0):
        a, b = b, a + b
    return b if n > 0 else 1


def _hidden_cases(challenge_id: str, public_inputs: list[dict], rng: secrets.SystemRandom) -> list[dict]:
    """Draws new cases within each quest's stated constraints, always including the edges."""
    if challenge_id == "patience-last-jump":
        domain, edges = range(1, 11), [1, 10]          # recursive discovery quest: 1 <= n <= 10
    elif challenge_id == "patience-two-slot-pouch":
        domain, edges = range(2, 46), [2, 45]          # pouch for ledge i: a = ways(i-2), b = ways(i-1)
    else:
        domain, edges = range(1, 46), [1, 45]          # route scroll and boss: 1 <= n <= 45
    public = {json.dumps(case, sort_keys=True) for case in public_inputs}
    chosen: list[int] = []
    for value in [*edges, *rng.sample(list(domain), len(domain))]:
        if len(chosen) >= HIDDEN_CASES_PER_CHALLENGE:
            break
        if value in chosen:
            continue
        case_input = {"a": ways(value - 2), "b": ways(value - 1)} if challenge_id == "patience-two-slot-pouch" else {"n": value}
        if json.dumps(case_input, sort_keys=True) in public:
            continue
        chosen.append(value)
    rng.shuffle(chosen)
    cases = []
    for value in chosen:
        if challenge_id == "patience-two-slot-pouch":
            a, b = ways(value - 2), ways(value - 1)
            case_input, expected = {"a": a, "b": b}, [b, a + b]
        elif challenge_id == "patience-route-scroll":
            case_input, expected = {"n": value}, [ways(i) for i in range(value + 1)]
        else:
            case_input, expected = {"n": value}, ways(value)
        cases.append({"id": f"p-{secrets.token_hex(4)}", "input": case_input, "expected": expected})
    return cases


def generated_pack() -> dict:
    """Public Run cases (also the animation replay) plus freshly drawn private Submit cases."""
    pack = skeleton()
    public_server = json.loads(SERVER_PACK.read_text())
    public_runs = {challenge["id"]: challenge["tests"]["run"] for challenge in [*public_server["quests"], public_server["boss"]]}
    rng = secrets.SystemRandom()
    for challenge in pack["challenges"]:
        run_cases = [{"id": case["id"], "input": case["input"], "expected": case["expected"]} for case in public_runs[challenge["id"]]]
        challenge["tests"] = {
            "run": run_cases,
            "submit": [*run_cases, *_hidden_cases(challenge["id"], [case["input"] for case in run_cases], rng)],
            # Replay details are returned to the browser, so the replay must be a public case.
            "replayCaseId": run_cases[-1]["id"],
        }
    return pack


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
    generate_cases = sub.add_parser("generate-cases", help="write a complete pack with freshly drawn private Submit cases (never commit or print it)")
    generate_cases.add_argument("path", type=Path)
    validate = sub.add_parser("validate", help="validate a completed private pack")
    validate.add_argument("path", type=Path)
    args = parser.parse_args()

    if args.command in ("generate", "generate-cases"):
        path = args.path.expanduser().resolve()
        if path.exists():
            raise SystemExit(f"refusing to overwrite {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        if args.command == "generate":
            path.write_text(json.dumps(skeleton(), indent=2) + "\n")
            print(f"wrote case-free skeleton to {path}")
            return 0
        pack = generated_pack()
        validate_private_pack(pack)  # fail before anything is written
        # Owner-only permissions: the file holds the hidden answers.
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(json.dumps(pack, indent=2) + "\n")
        load_private_pack(path)
        counts = ", ".join(f"{c['id']}: {len(c['tests']['submit']) - len(c['tests']['run'])} private" for c in pack["challenges"])
        print(f"wrote validated private pack to {path} ({counts}); contents not printed")
        return 0

    load_private_pack(args.path.expanduser().resolve())
    print("private pack is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
