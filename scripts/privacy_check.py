#!/usr/bin/env python3
"""Fail closed when private grading material can enter tracked/public/client output."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_FIXTURE = Path("runner/tests/fixtures/non-production-private-pack.json")
PRIVATE_SCHEMA = "quest-private-pack.v1"


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def tracked_files() -> list[Path]:
    output = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    return [Path(item.decode()) for item in output.split(b"\0") if item]


def walk(value: Any, path: str = "$"):
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            yield key, child, child_path
            yield from walk(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, f"{path}[{index}]")


def challenge_list(pack: dict[str, Any]) -> list[dict[str, Any]]:
    return [*pack.get("quests", []), pack.get("boss", {})]


def escaped_variants(value: str) -> set[str]:
    encoded = json.dumps(value, ensure_ascii=False)
    return {value, encoded, encoded[1:-1]}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-dir", default=".next", help="production build directory to inspect")
    parser.add_argument("--skip-build", action="store_true", help="skip client chunk inspection")
    args = parser.parse_args()
    errors: list[str] = []
    tracked = tracked_files()

    for path in tracked:
        text = path.as_posix()
        if re.search(r"(^|/)\.private(?:/|$)|\.private(?:\.|$)", text):
            fail(errors, f"tracked private path is forbidden: {text}")

    private_json_files: list[Path] = []
    for path in tracked:
        if path.suffix != ".json":
            continue
        try:
            parsed = json.loads((ROOT / path).read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(parsed, dict) and parsed.get("schemaVersion") == PRIVATE_SCHEMA:
            private_json_files.append(path)
    if private_json_files != [ALLOWED_FIXTURE]:
        fail(errors, f"tracked private packs must be exactly {ALLOWED_FIXTURE}; found {private_json_files}")

    fixture = json.loads((ROOT / ALLOWED_FIXTURE).read_text())
    if not str(fixture.get("fixtureLabel", "")).startswith("NON-PRODUCTION CI/E2E FIXTURE"):
        fail(errors, f"{ALLOWED_FIXTURE} must carry the NON-PRODUCTION CI/E2E fixture label")
    for challenge in fixture.get("challenges", []):
        tests = challenge.get("tests", {})
        if tests.get("submit") != tests.get("run"):
            fail(errors, f"{ALLOWED_FIXTURE} may contain only already-public Run cases: {challenge.get('id')}")

    server_files = sorted((ROOT / "content/server").glob("*.json"))
    public_files = sorted((ROOT / "content/public").glob("*.json"))
    if not server_files or not public_files:
        fail(errors, "server and public pack projections must both exist")

    server_only_needles: set[str] = {PRIVATE_SCHEMA, "NON-PRODUCTION CI/E2E FIXTURE", '"submit":['}
    for server_file in server_files:
        pack = json.loads(server_file.read_text())
        for challenge in challenge_list(pack):
            solution = challenge.get("solution", {})
            for field in ("code", "explanation"):
                value = solution.get(field)
                if isinstance(value, str) and value:
                    server_only_needles.update(escaped_variants(value))
            for hint in challenge.get("hints", []):
                value = hint.get("text")
                if isinstance(value, str) and value:
                    server_only_needles.update(escaped_variants(value))

    for public_file in public_files:
        pack = json.loads(public_file.read_text())
        for key, value, path in walk(pack):
            if key == "solution":
                fail(errors, f"public projection exposes a solution at {public_file.relative_to(ROOT)}:{path}")
            if key == "submit":
                fail(errors, f"public projection exposes a submit suite at {public_file.relative_to(ROOT)}:{path}")
            if key == "text" and isinstance(value, str):
                fail(errors, f"public projection exposes hint text at {public_file.relative_to(ROOT)}:{path}")

    if not args.skip_build:
        static_dir = (ROOT / args.build_dir / "static").resolve()
        if not static_dir.is_dir():
            fail(errors, f"production client chunks not found at {static_dir}; run npm run build first")
        else:
            service_role_value = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            sensitive = set(server_only_needles)
            sensitive.update({"SUPABASE_SERVICE_ROLE_KEY", "service_role_key", "serviceRoleKey"})
            if service_role_value:
                sensitive.update(escaped_variants(service_role_value))
            for chunk in static_dir.rglob("*.js"):
                text = chunk.read_text(errors="ignore")
                for needle in sensitive:
                    if needle and needle in text:
                        fail(errors, f"client chunk {chunk.relative_to(ROOT)} contains server-only marker {needle[:80]!r}")
                        break

    if errors:
        print("privacy check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"privacy check passed: {len(tracked)} tracked files, {len(public_files)} public pack(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
