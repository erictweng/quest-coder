"""CPython execution and grading engine for Quest Coder.

Submitted code is executed by ``execute_case`` and graded by ``run_one_case``.
With ``isolate=True`` (what the CLI uses) every case executes in a separate
worker process that receives only the source and the case inputs, so expected
values and the verdict never share an interpreter with submitted code.

The source checks and resource limits here are defense in depth. They are not
an OS isolation boundary; the runner service must still be deployed in a
locked-down container or microVM.
"""

from __future__ import annotations

import ast
import copy
import json
import math
import resource
import signal
import subprocess
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from types import FrameType
from typing import Any, Callable, Dict, Iterable, List as PyList, Optional

USER_FILENAME = "<quest-user>"
WORKER_PATH = Path(__file__).resolve().parent / "case_worker.py"
WORKER_KILL_GRACE_MS = 500
MAX_WORKER_OUTPUT_BYTES = 2_000_000
# Larger integers cannot be converted to text on CPython 3.11+ and are never a correct answer here.
MAX_INT_BITS = 4096
EXECUTION_ERROR_KINDS = {"compile_error", "runtime_error", "loop_guard", "off_end_read"}
NOT_RUN_MESSAGE = "not run: the time limit was already used up by an earlier case"
BLOCKED_SOURCE_NAMES = {"open", "eval", "exec", "compile", "input", "globals", "locals", "vars", "dir", "getattr", "setattr", "delattr", "__import__"}
BLOCKED_ATTRIBUTE_ROOTS = {"os", "sys", "socket", "subprocess", "pathlib", "shutil"}
TRACKED_NAMES = {
    "a",
    "b",
    "i",
    "n",
    "ways",
    "dp",
    "memo",
    "l",
    "left",
    "lo",
    "low",
    "r",
    "right",
    "hi",
    "high",
    "mid",
    "m",
    "middle",
    "slow",
    "fast",
    "prev",
    "curr",
    "next",
    "target",
}


class RunnerTimeout(BaseException):
    """Raised when the wall-time guard fires.

    Derives from BaseException so a bare ``except Exception`` in submitted code
    cannot swallow the guard.
    """


class DummySubscriptable:
    def __getitem__(self, _item: Any) -> "DummySubscriptable":
        return self


class ListNode:
    def __init__(self, val: int = 0, next: Optional["ListNode"] = None, recorder: Optional["Recorder"] = None, node_id: Optional[str] = None):
        object.__setattr__(self, "_val", val)
        object.__setattr__(self, "_next", next)
        object.__setattr__(self, "_recorder", recorder)
        object.__setattr__(self, "_node_id", node_id or f"node-{id(self)}")

    @property
    def val(self) -> int:
        recorder = object.__getattribute__(self, "_recorder")
        if recorder:
            recorder.node_read(object.__getattribute__(self, "_node_id"), "val", object.__getattribute__(self, "_val"))
        return object.__getattribute__(self, "_val")

    @val.setter
    def val(self, value: int) -> None:
        object.__setattr__(self, "_val", value)

    @property
    def next(self) -> Optional["ListNode"]:
        recorder = object.__getattribute__(self, "_recorder")
        nxt = object.__getattribute__(self, "_next")
        if recorder:
            recorder.node_read(object.__getattribute__(self, "_node_id"), "next", node_to_list(nxt, limit=20) if nxt else None)
        return nxt

    @next.setter
    def next(self, value: Optional["ListNode"]) -> None:
        object.__setattr__(self, "_next", value)


@dataclass
class Recorder:
    enabled: bool
    max_events: int = 3000
    events: PyList[Dict[str, Any]] = field(default_factory=list)
    read_count: int = 0
    off_end_read: Optional[Dict[str, Any]] = None

    @property
    def truncated(self) -> bool:
        return len(self.events) >= self.max_events

    def add(self, event: Dict[str, Any]) -> None:
        if not self.enabled or len(self.events) >= self.max_events:
            return
        event = dict(event)
        event.setdefault("i", len(self.events))
        event.setdefault("t", len(self.events))
        self.events.append(event)

    def line(self, frame: FrameType) -> None:
        self.add({"kind": "line", "line": frame.f_lineno, "vars": capture_vars(frame)})

    def read(self, name: str, index: int, value: Any = None, off_end: bool = False) -> None:
        self.read_count += 1
        frame = first_user_frame()
        event: Dict[str, Any] = {
            "kind": "read",
            "line": frame.f_lineno if frame else None,
            "ref": {"structure": "array", "name": name, "index": index},
            "readCount": self.read_count,
            "offEnd": off_end,
            "vars": capture_vars(frame) if frame else {},
        }
        if not off_end:
            event["value"] = make_jsonable(value)
        else:
            self.off_end_read = event
        self.add(event)

    def node_read(self, node_id: str, field: str, value: Any = None) -> None:
        self.read_count += 1
        frame = first_user_frame()
        self.add({
            "kind": "read",
            "line": frame.f_lineno if frame else None,
            "ref": {"structure": "linked_list", "name": "list", "nodeId": node_id, "field": field},
            "value": make_jsonable(value),
            "readCount": self.read_count,
            "vars": capture_vars(frame) if frame else {},
        })


class CountingList:
    """List wrapper that counts algorithm reads for budget enforcement."""

    def __init__(self, values: Iterable[Any], recorder: Recorder, name: str = "nums"):
        self._values = list(values)
        self._recorder = recorder
        self._name = name

    def __len__(self) -> int:
        return len(self._values)

    def __getitem__(self, index: Any) -> Any:
        if isinstance(index, slice):
            result = self._values[index]
            start, stop, step = index.indices(len(self._values))
            for i in range(start, stop, step):
                self._recorder.read(self._name, i, self._values[i])
            return result
        if index < 0:
            normalized = len(self._values) + index
        else:
            normalized = index
        if normalized < 0 or normalized >= len(self._values):
            self._recorder.read(self._name, int(index), off_end=True)
            raise IndexError("list index out of range")
        value = self._values[index]
        self._recorder.read(self._name, int(index), value)
        return value

    def __iter__(self):
        for i, value in enumerate(self._values):
            self._recorder.read(self._name, i, value)
            yield value

    def __contains__(self, item: Any) -> bool:
        for i, value in enumerate(self._values):
            self._recorder.read(self._name, i, value)
            if value == item:
                return True
        return False

    def index(self, item: Any) -> int:
        for i, value in enumerate(self._values):
            self._recorder.read(self._name, i, value)
            if value == item:
                return i
        raise ValueError(f"{item!r} is not in list")

    def count(self, item: Any) -> int:
        total = 0
        for i, value in enumerate(self._values):
            self._recorder.read(self._name, i, value)
            if value == item:
                total += 1
        return total

    def raw(self) -> PyList[Any]:
        return list(self._values)

    def __repr__(self) -> str:
        return repr(self._values)


def make_jsonable(value: Any) -> Any:
    if isinstance(value, CountingList):
        return value.raw()
    if isinstance(value, ListNode):
        return node_to_list(value)
    if isinstance(value, float) and not math.isfinite(value):
        # JSON has no inf/nan; show them as text so the result stays valid JSON.
        return repr(value)
    if isinstance(value, int) and not isinstance(value, bool) and value.bit_length() > MAX_INT_BITS:
        return f"<integer with {value.bit_length()} bits>"
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, (list, tuple)):
        return [make_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): make_jsonable(v) for k, v in value.items()}
    return repr(value)


def list_to_nodes(values: PyList[Any], recorder: Recorder, prefix: str = "node", cycle_pos: Optional[int] = None) -> Optional[ListNode]:
    nodes = [ListNode(value, None, recorder, f"{prefix}-{index}") for index, value in enumerate(values)]
    for left, right in zip(nodes, nodes[1:]):
        object.__setattr__(left, "_next", right)
    if nodes and cycle_pos is not None and 0 <= cycle_pos < len(nodes):
        object.__setattr__(nodes[-1], "_next", nodes[cycle_pos])
    return nodes[0] if nodes else None


def node_to_list(node: Optional[ListNode], limit: int = 100) -> PyList[Any]:
    values: PyList[Any] = []
    seen: set[int] = set()
    current = node
    while current is not None and len(values) < limit:
        identity = id(current)
        if identity in seen:
            values.append("cycle")
            break
        seen.add(identity)
        values.append(object.__getattribute__(current, "_val"))
        current = object.__getattribute__(current, "_next")
    return values


def capture_vars(frame: Optional[FrameType]) -> Dict[str, Any]:
    if frame is None:
        return {}
    values: Dict[str, Any] = {}
    for name, value in frame.f_locals.items():
        if name in TRACKED_NAMES:
            values[name] = make_jsonable(value)
    return values


def first_user_frame() -> Optional[FrameType]:
    frame = sys._getframe()
    while frame:
        if frame.f_code.co_filename == USER_FILENAME:
            return frame
        frame = frame.f_back
    return None


def trace_factory(recorder: Recorder) -> Callable[[FrameType, str, Any], Any]:
    def tracer(frame: FrameType, event: str, arg: Any):
        if frame.f_code.co_filename == USER_FILENAME and event == "line":
            recorder.line(frame)
        return tracer

    return tracer


def _timeout_handler(_signum: int, _frame: Optional[FrameType]) -> None:
    raise RunnerTimeout("execution exceeded wall-time guard")


def guarded_call(fn: Callable[[], Any], timeout_ms: int) -> Any:
    old_handler = signal.getsignal(signal.SIGALRM)
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.setitimer(signal.ITIMER_REAL, timeout_ms / 1000)
    try:
        return fn()
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old_handler)


def validate_public_source(source: str) -> None:
    """Block public-unsafe Python capabilities before compilation."""
    if len(source.encode("utf-8")) > 24_000:
        raise ValueError("source exceeds public size limit")
    tree = ast.parse(source, filename=USER_FILENAME)
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise ValueError("imports are disabled in the public runner")
        if isinstance(node, ast.Name) and node.id in BLOCKED_SOURCE_NAMES:
            raise ValueError(f"{node.id} is disabled in the public runner")
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise ValueError("dunder attribute access is disabled in the public runner")
        if isinstance(node, ast.Name) and node.id in BLOCKED_ATTRIBUTE_ROOTS:
            raise ValueError(f"{node.id} access is disabled in the public runner")


def apply_resource_limits(timeout_ms: int) -> None:
    """Best-effort per-process CPU and memory guard for local CPython."""
    cpu_seconds = math.ceil(timeout_ms / 1000) + 2
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
    except (ValueError, OSError):
        pass
    try:
        memory_bytes = 256 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    except (ValueError, OSError):
        pass


def build_namespace(source: str) -> Dict[str, Any]:
    validate_public_source(source)
    namespace: Dict[str, Any] = {
        "List": DummySubscriptable(),
        "Optional": DummySubscriptable(),
        "ListNode": ListNode,
        "__name__": "quest_user_submission",
        "__builtins__": {
            "__build_class__": __build_class__,
            "abs": abs,
            "all": all,
            "any": any,
            "bool": bool,
            "dict": dict,
            "enumerate": enumerate,
            "float": float,
            "int": int,
            "len": len,
            "list": list,
            "max": max,
            "min": min,
            "range": range,
            "reversed": reversed,
            "set": set,
            "str": str,
            "sum": sum,
            "tuple": tuple,
            "ValueError": ValueError,
            "IndexError": IndexError,
        },
    }
    compiled = compile(source, USER_FILENAME, "exec")
    exec(compiled, namespace)
    return namespace


def resolve_entrypoint(namespace: Dict[str, Any], entrypoint: str) -> Callable[..., Any]:
    if entrypoint == "Solution().search":
        return namespace["Solution"]().search
    value = namespace
    current: Any = value
    for part in entrypoint.split("."):
        if part.endswith("()"):
            current = current[part[:-2]]() if isinstance(current, dict) else getattr(current, part[:-2])()
        else:
            current = current[part] if isinstance(current, dict) else getattr(current, part)
    return current


def wrap_inputs(inputs: Dict[str, Any], recorder: Recorder) -> Dict[str, Any]:
    wrapped: Dict[str, Any] = {}
    for name, value in inputs.items():
        if name == "pos":
            continue
        if name in {"head", "list1", "list2"} and isinstance(value, list):
            cycle_pos = inputs.get("pos") if name == "head" and isinstance(inputs.get("pos"), int) else None
            wrapped[name] = list_to_nodes(value, recorder, name, cycle_pos)
        elif isinstance(value, list):
            wrapped[name] = CountingList(value, recorder, name)
        else:
            wrapped[name] = copy.deepcopy(value)
    return wrapped


def replay_input_from_test(test: Dict[str, Any]) -> Dict[str, Any]:
    inputs = test.get("input", {})
    if "head" in inputs or "list1" in inputs or "list2" in inputs:
        values = inputs.get("head", inputs.get("list1", []))
        return {
            "structure": "linked_list",
            "values": make_jsonable(values),
            "target": make_jsonable(inputs.get("pos")),
            "expectedIndex": make_jsonable(test.get("expected")),
        }
    values = inputs.get("nums", [])
    return {
        "structure": "array",
        "values": make_jsonable(values),
        "target": make_jsonable(inputs.get("target")),
        "expectedIndex": make_jsonable(test.get("expected")),
    }


def execute_case(
    source: str,
    inputs: Dict[str, Any],
    *,
    entrypoint: str,
    trace: bool,
    timeout_ms: int,
    max_events: int,
) -> Dict[str, Any]:
    """Execute submitted code on one input and report what it did.

    This function never sees the expected value: grading happens in the caller.
    """
    recorder = Recorder(enabled=trace, max_events=max_events)
    started = time.time()
    actual: Any = None
    error: Optional[Dict[str, Any]] = None

    try:
        namespace = build_namespace(source)
        fn = resolve_entrypoint(namespace, entrypoint)
        arg_values = list(wrap_inputs(inputs, recorder).values())

        def invoke() -> Any:
            if trace:
                sys.settrace(trace_factory(recorder))
            try:
                return fn(*arg_values)
            finally:
                if trace:
                    sys.settrace(None)

        actual = make_jsonable(guarded_call(invoke, timeout_ms))
    except SyntaxError as exc:
        error = {"kind": "compile_error", "message": exc.msg, "line": exc.lineno}
    except RunnerTimeout as exc:
        error = {"kind": "loop_guard", "message": str(exc)}
    except Exception as exc:  # noqa: BLE001 - runner must classify arbitrary user errors.
        if recorder.off_end_read is not None or isinstance(exc, IndexError):
            error = {"kind": "off_end_read", "message": str(exc), "line": recorder.off_end_read.get("line") if recorder.off_end_read else None}
        else:
            tb = traceback.extract_tb(exc.__traceback__)
            user_line = next((entry.lineno for entry in reversed(tb) if entry.filename == USER_FILENAME), None)
            error = {"kind": "runtime_error", "message": f"{type(exc).__name__}: {exc}", "line": user_line}
    finally:
        sys.settrace(None)

    return {
        "actual": actual,
        "error": error,
        "readCount": recorder.read_count,
        "events": recorder.events,
        "truncated": recorder.truncated,
        "durationMs": int((time.time() - started) * 1000),
        "memoryKb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    }


def _failed_execution(kind: str, message: str, duration_ms: int = 0) -> Dict[str, Any]:
    return {"actual": None, "error": {"kind": kind, "message": message}, "readCount": 0, "events": [], "truncated": False, "durationMs": duration_ms, "memoryKb": 0}


def execute_case_isolated(
    source: str,
    inputs: Dict[str, Any],
    *,
    entrypoint: str,
    trace: bool,
    timeout_ms: int,
    max_events: int,
) -> Dict[str, Any]:
    """Run ``execute_case`` in a throwaway worker process.

    The worker gets the source and inputs only. It is killed if it outlives the
    in-process guard, and its output is treated as untrusted data.
    """
    request = json.dumps({"source": source, "inputs": inputs, "entrypoint": entrypoint, "trace": trace, "timeoutMs": timeout_ms, "maxEvents": max_events})
    started = time.time()
    try:
        proc = subprocess.run(
            [sys.executable, str(WORKER_PATH)],
            input=request,
            text=True,
            capture_output=True,
            timeout=(timeout_ms + WORKER_KILL_GRACE_MS) / 1000,
            env={"PATH": "/usr/bin:/bin", "PYTHONSAFEPATH": "1", "PYTHONDONTWRITEBYTECODE": "1"},
        )
    except subprocess.TimeoutExpired:
        return _failed_execution("loop_guard", "execution exceeded wall-time guard", int((time.time() - started) * 1000))
    duration_ms = int((time.time() - started) * 1000)
    if proc.returncode != 0:
        return _failed_execution("runtime_error", "execution stopped: the program exceeded its memory or CPU limit", duration_ms)
    if len(proc.stdout) > MAX_WORKER_OUTPUT_BYTES:
        return _failed_execution("runtime_error", "execution produced too much output", duration_ms)
    try:
        return _sanitize_execution(json.loads(proc.stdout, parse_constant=_reject_constant))
    except (ValueError, TypeError, KeyError):
        return _failed_execution("runtime_error", "execution produced an unreadable result", duration_ms)


def _reject_constant(name: str) -> Any:
    raise ValueError(f"non-standard JSON constant {name}")


def _sanitize_execution(raw: Any) -> Dict[str, Any]:
    """Coerce worker output into the execute_case shape without trusting it."""
    if not isinstance(raw, dict):
        raise ValueError("worker result must be an object")
    error = raw.get("error")
    if error is not None:
        if not isinstance(error, dict):
            raise ValueError("worker error must be an object")
        kind = error.get("kind")
        line = error.get("line")
        error = {
            "kind": kind if kind in EXECUTION_ERROR_KINDS else "runtime_error",
            "message": str(error.get("message", ""))[:2000],
            "line": line if isinstance(line, int) else None,
        }
    events = raw.get("events")
    return {
        "actual": raw.get("actual"),
        "error": error,
        "readCount": int(raw.get("readCount", 0)),
        "events": [event for event in events if isinstance(event, dict)] if isinstance(events, list) else [],
        "truncated": bool(raw.get("truncated")),
        "durationMs": int(raw.get("durationMs", 0)),
        "memoryKb": int(raw.get("memoryKb", 0)),
    }


def run_one_case(
    source: str,
    test: Dict[str, Any],
    *,
    entrypoint: str,
    trace: bool,
    budget_limit: Optional[int],
    timeout_ms: int,
    max_events: int,
    isolate: bool = False,
    skip_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute one case and grade the outcome against the expected value."""
    expected = test.get("expected")
    inputs = test.get("input", {})
    if skip_reason is not None:
        execution = _failed_execution("loop_guard", skip_reason)
    else:
        execute = execute_case_isolated if isolate else execute_case
        execution = execute(source, inputs, entrypoint=entrypoint, trace=trace, timeout_ms=timeout_ms, max_events=max_events)

    error = execution["error"]
    actual = execution["actual"]
    read_count = execution["readCount"]
    over_budget = budget_limit is not None and read_count > budget_limit
    if error is not None:
        status = error["kind"]
    elif actual != make_jsonable(expected):
        status = "wrong_answer"
    elif over_budget:
        status = "over_budget"
    else:
        status = "passed"

    events = execution["events"][:max_events]
    if trace and len(events) < max_events:
        outcome: Dict[str, Any] = {"kind": "outcome", "status": status, "message": error["message"] if error else status}
        if expected is not None:
            outcome["expected"] = make_jsonable(expected)
        if actual is not None:
            outcome["actual"] = actual
        outcome["i"] = outcome["t"] = len(events)
        events.append(outcome)

    return {
        "caseId": test.get("id", "case"),
        "status": status,
        "passed": status == "passed",
        "expected": make_jsonable(expected),
        "actual": actual,
        "error": error,
        "budget": {
            "enabled": budget_limit is not None,
            "limit": budget_limit,
            "used": read_count,
            "unit": "array_read",
            "exceeded": over_budget,
        },
        "summary": {
            "durationMs": execution["durationMs"],
            "eventCount": len(events),
            "truncated": execution["truncated"] or len(events) >= max_events,
            "memoryKb": execution["memoryKb"],
        },
        "input": replay_input_from_test(test),
        "arguments": make_jsonable(inputs),
        "events": events,
    }


def choose_replay_case(cases: PyList[Dict[str, Any]], tests: PyList[Dict[str, Any]], replay_case_id: Optional[str] = None) -> int:
    if replay_case_id:
        for idx, test in enumerate(tests):
            if test.get("id") == replay_case_id:
                return idx
    for idx, case in enumerate(cases):
        if case["status"] != "passed":
            return idx
    return 0 if tests else -1


def run_submission(
    source: str,
    tests: PyList[Dict[str, Any]],
    *,
    quest_id: str = "quest",
    entrypoint: str = "Solution().search",
    budget_limit: Optional[int] = None,
    timeout_ms: int = 1000,
    max_events: int = 3000,
    mode: str = "submit",
    replay_test: Optional[Dict[str, Any]] = None,
    isolate: bool = False,
    total_budget_ms: Optional[int] = None,
) -> Dict[str, Any]:
    """Run source against tests, then replay one case with tracing enabled.

    ``total_budget_ms`` bounds the whole submission, so a caller with its own
    deadline always gets a classified result back. Once a case hits the loop
    guard the remaining fast cases are reported as not run instead of each
    burning a full time limit.
    """
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    deadline = None if total_budget_ms is None else time.monotonic() + total_budget_ms / 1000

    def case_timeout_ms() -> Optional[int]:
        """Time limit for the next case, or None when the total budget is spent."""
        if deadline is None:
            return timeout_ms
        remaining_ms = int((deadline - time.monotonic()) * 1000) - WORKER_KILL_GRACE_MS
        return min(timeout_ms, remaining_ms) if remaining_ms >= 50 else None

    def run_case(test: Dict[str, Any], trace: bool, skip_reason: Optional[str] = None) -> Dict[str, Any]:
        limit = case_timeout_ms()
        if limit is None and skip_reason is None:
            skip_reason = NOT_RUN_MESSAGE
        return run_one_case(
            source,
            test,
            entrypoint=entrypoint,
            trace=trace,
            budget_limit=budget_limit,
            timeout_ms=limit or timeout_ms,
            max_events=max_events,
            isolate=isolate,
            skip_reason=skip_reason,
        )

    fast_cases: PyList[Dict[str, Any]] = []
    guard_tripped = False
    for test in tests:
        case = run_case(test, trace=False, skip_reason=NOT_RUN_MESSAGE if guard_tripped else None)
        guard_tripped = guard_tripped or case["status"] == "loop_guard"
        fast_cases.append(case)

    replay_source = replay_test or (tests[choose_replay_case(fast_cases, tests)] if tests else None)
    replay_index = choose_replay_case(fast_cases, tests, replay_source.get("id") if replay_source else None)
    replay_case = run_case(replay_source, trace=True) if replay_source is not None else None

    first_bad = next((case for case in fast_cases if case["status"] != "passed"), None)
    if first_bad:
        top_status = first_bad["status"]
    else:
        top_status = "passed" if fast_cases else "internal_error"

    return {
        "schemaVersion": "timeline.v0",
        "questId": quest_id,
        "language": "python",
        "status": top_status,
        "passed": top_status == "passed",
        "startedAt": started_at,
        "execution": {"passes": ["fast", "traced_replay"], "mode": mode, "suiteSize": len(tests), "replayCaseIndex": replay_index, "replayCaseId": replay_case.get("caseId") if replay_case else None},
        "cases": fast_cases,
        "replay": replay_case,
        "limits": {"maxEvents": max_events, "maxDurationMs": timeout_ms, "maxReads": budget_limit},
    }


def default_rotated_budget(n: int) -> int:
    return 4 * math.ceil(math.log2(n + 1)) + 16
