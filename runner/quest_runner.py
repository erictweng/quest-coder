"""Local CPython runner spike for Quest Coder Sprint 1.

This is not a public-safe sandbox. It is a local engine spike that proves
classification, read budgets, tracing, two-pass execution, and guard shape.
"""

from __future__ import annotations

import ast
import copy
import math
import resource
import signal
import sys
import time
import traceback
from dataclasses import dataclass, field
from types import FrameType
from typing import Any, Callable, Dict, Iterable, List as PyList, Optional

USER_FILENAME = "<quest-user>"
BLOCKED_SOURCE_NAMES = {"open", "eval", "exec", "compile", "input", "globals", "locals", "vars", "dir", "getattr", "setattr", "delattr", "__import__"}
BLOCKED_ATTRIBUTE_ROOTS = {"os", "sys", "socket", "subprocess", "pathlib", "shutil"}
TRACKED_NAMES = {
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


class RunnerTimeout(Exception):
    """Raised when the wall-time guard fires."""


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

    def outcome(self, status: str, expected: Any = None, actual: Any = None, message: str = "") -> None:
        event: Dict[str, Any] = {"kind": "outcome", "status": status, "message": message}
        if expected is not None:
            event["expected"] = make_jsonable(expected)
        if actual is not None:
            event["actual"] = make_jsonable(actual)
        self.add(event)


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
    cpu_seconds = max(30, math.ceil(timeout_ms / 1000) + 10)
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


def run_one_case(
    source: str,
    test: Dict[str, Any],
    *,
    entrypoint: str,
    trace: bool,
    budget_limit: Optional[int],
    timeout_ms: int,
    max_events: int,
) -> Dict[str, Any]:
    recorder = Recorder(enabled=trace, max_events=max_events)
    started = time.time()
    expected = test.get("expected")
    actual: Any = None
    status = "internal_error"
    error: Optional[Dict[str, Any]] = None

    try:
        apply_resource_limits(timeout_ms)
        namespace = build_namespace(source)
        fn = resolve_entrypoint(namespace, entrypoint)
        inputs = wrap_inputs(test.get("input", {}), recorder)
        arg_values = list(inputs.values())

        def invoke() -> Any:
            if trace:
                sys.settrace(trace_factory(recorder))
            try:
                return fn(*arg_values)
            finally:
                if trace:
                    sys.settrace(None)

        actual = guarded_call(invoke, timeout_ms)
        actual_json = make_jsonable(actual)
        if actual_json != expected:
            status = "wrong_answer"
        elif budget_limit is not None and recorder.read_count > budget_limit:
            status = "over_budget"
        else:
            status = "passed"
    except SyntaxError as exc:
        status = "compile_error"
        error = {"kind": status, "message": exc.msg, "line": exc.lineno}
    except RunnerTimeout as exc:
        status = "loop_guard"
        error = {"kind": status, "message": str(exc)}
    except Exception as exc:  # noqa: BLE001 - runner must classify arbitrary user errors.
        if recorder.off_end_read is not None or isinstance(exc, IndexError):
            status = "off_end_read"
            error = {"kind": status, "message": str(exc), "line": recorder.off_end_read.get("line") if recorder.off_end_read else None}
        else:
            status = "runtime_error"
            tb = traceback.extract_tb(exc.__traceback__)
            user_line = next((entry.lineno for entry in reversed(tb) if entry.filename == USER_FILENAME), None)
            error = {"kind": status, "message": f"{type(exc).__name__}: {exc}", "line": user_line}
    finally:
        sys.settrace(None)

    duration_ms = int((time.time() - started) * 1000)
    recorder.outcome(status, expected=expected, actual=actual, message=error["message"] if error else status)
    memory_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return {
        "caseId": test.get("id", "case"),
        "status": status,
        "passed": status == "passed",
        "expected": make_jsonable(expected),
        "actual": make_jsonable(actual),
        "error": error,
        "budget": {
            "enabled": budget_limit is not None,
            "limit": budget_limit,
            "used": recorder.read_count,
            "unit": "array_read",
            "exceeded": budget_limit is not None and recorder.read_count > budget_limit,
        },
        "summary": {
            "durationMs": duration_ms,
            "eventCount": len(recorder.events),
            "truncated": recorder.truncated,
            "memoryKb": memory_kb,
        },
        "input": replay_input_from_test(test),
        "events": recorder.events,
    }


def choose_replay_case(cases: PyList[Dict[str, Any]], tests: PyList[Dict[str, Any]]) -> int:
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
) -> Dict[str, Any]:
    """Run source against tests, then replay one case with tracing enabled."""
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    fast_cases = [
        run_one_case(
            source,
            test,
            entrypoint=entrypoint,
            trace=False,
            budget_limit=budget_limit,
            timeout_ms=timeout_ms,
            max_events=max_events,
        )
        for test in tests
    ]
    replay_index = choose_replay_case(fast_cases, tests)
    replay_case = None
    if replay_index >= 0:
        replay_case = run_one_case(
            source,
            tests[replay_index],
            entrypoint=entrypoint,
            trace=True,
            budget_limit=budget_limit,
            timeout_ms=timeout_ms,
            max_events=max_events,
        )

    top_status = "passed" if fast_cases and all(case["status"] == "passed" for case in fast_cases) else (fast_cases[0]["status"] if fast_cases else "internal_error")
    first_bad = next((case for case in fast_cases if case["status"] != "passed"), None)
    if first_bad:
        top_status = first_bad["status"]

    return {
        "schemaVersion": "timeline.v0",
        "questId": quest_id,
        "language": "python",
        "status": top_status,
        "passed": top_status == "passed",
        "startedAt": started_at,
        "execution": {"passes": ["fast", "traced_replay"], "replayCaseIndex": replay_index},
        "cases": fast_cases,
        "replay": replay_case,
        "limits": {"maxEvents": max_events, "maxDurationMs": timeout_ms, "maxReads": budget_limit},
    }


def default_rotated_budget(n: int) -> int:
    return 4 * math.ceil(math.log2(n + 1)) + 8
