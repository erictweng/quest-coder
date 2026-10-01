from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from runner.quest_runner import default_rotated_budget, run_submission

DEFAULT_TESTS: list[dict[str, Any]] = [
    {"id": "small-found", "input": {"nums": [4, 5, 6, 7, 0, 1, 2], "target": 0}, "expected": 4},
    {"id": "small-missing", "input": {"nums": [4, 5, 6, 7, 0, 1, 2], "target": 3}, "expected": -1},
    {"id": "large-found", "input": {"nums": list(range(96, 256)) + list(range(96)), "target": 95}, "expected": 255},
]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        source = payload["source"]
        if not isinstance(source, str) or not source.strip():
            raise ValueError("source must be a non-empty string")
        result = run_submission(
            source,
            DEFAULT_TESTS,
            quest_id="timequake-search-rotated-array",
            entrypoint="Solution().search",
            budget_limit=default_rotated_budget(256),
            timeout_ms=2000,
            max_events=3000,
        )
        print(json.dumps(result))
        return 0
    except Exception as exc:  # noqa: BLE001 - command-line bridge should emit safe failure JSON.
        print(json.dumps({"error": f"{type(exc).__name__}: {exc}"}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
