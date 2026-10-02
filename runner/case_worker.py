"""Worker process that executes one case of submitted code.

Reads ``{source, inputs, entrypoint, trace, timeoutMs, maxEvents}`` as JSON on
stdin and writes the ``execute_case`` result as JSON on stdout. It is never
given expected values, so it cannot grade and has nothing to leak.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from runner.quest_runner import apply_resource_limits, execute_case


def main() -> int:
    request = json.load(sys.stdin)
    timeout_ms = int(request["timeoutMs"])
    apply_resource_limits(timeout_ms)
    result = execute_case(
        request["source"],
        request["inputs"],
        entrypoint=request["entrypoint"],
        trace=bool(request["trace"]),
        timeout_ms=timeout_ms,
        max_events=int(request["maxEvents"]),
    )
    json.dump(result, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
