# Timeline Format Draft

This is the Sprint 0 sandbox-to-scene contract draft. Sprint 1 may adjust fields after the CPython trace spike, but runner output and replay input should keep this shape conceptually stable.

## Top-level run result

```ts
type RunResult = {
  schemaVersion: "timeline.v0";
  runId: string;
  questId: string;
  caseId: string;
  language: "python";
  status:
    | "passed"
    | "wrong_answer"
    | "compile_error"
    | "runtime_error"
    | "over_budget"
    | "loop_guard"
    | "off_end_read"
    | "internal_error";
  passed: boolean;
  expected?: JsonValue;
  actual?: JsonValue;
  error?: RunError;
  budget: ReadBudget;
  summary: RunSummary;
  input: ReplayInput;
  events: TimelineEvent[];
  limits: TimelineLimits;
};
```

## Error object

```ts
type RunError = {
  kind:
    | "compile_error"
    | "runtime_error"
    | "loop_guard"
    | "off_end_read"
    | "internal_error";
  message: string;
  line?: number;
  traceback?: string[];
};
```

- `message` is safe to show in the UI.
- `line` uses the player's submitted source line numbers.
- `traceback` is optional and may be hidden behind developer/debug UI.

## Read budget

```ts
type ReadBudget = {
  enabled: boolean;
  limit?: number;
  used: number;
  unit: "array_read" | "node_read" | "field_read";
  exceeded: boolean;
};
```

`len()` is free for arrays. For array wrappers, index reads count one, slices count by slice length, and iteration/contains/index/count count one per visited element.

## Summary

```ts
type RunSummary = {
  startedAt: string;
  durationMs: number;
  eventCount: number;
  truncated: boolean;
  firstFailingEventIndex?: number;
  solutionAssisted?: boolean;
};
```

## Replay input

```ts
type ReplayInput = {
  structure: "array" | "linked_list" | "tree" | "graph" | "custom";
  values: JsonValue;
  target?: JsonValue;
  expectedIndex?: number;
  sceneHints?: Record<string, JsonValue>;
};
```

The renderer uses this to draw the static world before applying events.

## Timeline events

```ts
type TimelineEvent =
  | LineEvent
  | ReadEvent
  | WriteEvent
  | CompareEvent
  | CallEvent
  | ReturnEvent
  | OutcomeEvent
  | NoteEvent;
```

Every event has shared metadata:

```ts
type BaseEvent = {
  i: number;
  t: number;
  kind: string;
  line?: number;
  vars?: Record<string, JsonValue>;
  note?: string;
};
```

- `i` is the zero-based event index.
- `t` is monotonic runner-relative time in milliseconds or logical ticks.
- `line` maps to submitted source.
- `vars` should include recognized algorithm variables such as `l`, `left`, `lo`, `r`, `right`, `hi`, `mid`, `slow`, `fast`, `prev`, `curr`, and `next` when available.

### Line event

```ts
type LineEvent = BaseEvent & {
  kind: "line";
  line: number;
};
```

Used to highlight the code panel even when no data read occurs.

### Read event

```ts
type ReadEvent = BaseEvent & {
  kind: "read";
  ref: DataRef;
  value?: JsonValue;
  readCount: number;
  offEnd?: boolean;
};
```

`offEnd: true` is recorded before raising the real index/field error so the replay can show the failure visually.

### Write event

```ts
type WriteEvent = BaseEvent & {
  kind: "write";
  ref: DataRef;
  before?: JsonValue;
  after: JsonValue;
};
```

Needed for later mutable structures. Sprint 1 may not emit this for arrays.

### Compare event

```ts
type CompareEvent = BaseEvent & {
  kind: "compare";
  left: JsonValue;
  op: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not_in";
  right: JsonValue;
  result: boolean;
};
```

Optional in Sprint 1 if line/read events already explain the run.

### Call and return events

```ts
type CallEvent = BaseEvent & {
  kind: "call";
  functionName: string;
  args?: Record<string, JsonValue>;
};

type ReturnEvent = BaseEvent & {
  kind: "return";
  functionName: string;
  value: JsonValue;
};
```

Useful for recursion and helper functions.

### Outcome event

```ts
type OutcomeEvent = BaseEvent & {
  kind: "outcome";
  status: RunResult["status"];
  expected?: JsonValue;
  actual?: JsonValue;
  message: string;
};
```

Every timeline should end with exactly one outcome event unless an internal runner error prevents timeline creation.

### Note event

```ts
type NoteEvent = BaseEvent & {
  kind: "note";
  severity: "info" | "warning" | "debug";
  message: string;
};
```

Used for replay limitations, truncation, or runner fallback notes.

## Data references

```ts
type DataRef =
  | { structure: "array"; name: string; index: number }
  | { structure: "linked_list"; name: string; nodeId: string; field?: "val" | "next" }
  | { structure: "tree"; name: string; nodeId: string; field?: "val" | "left" | "right" }
  | { structure: "custom"; name: string; path: string };
```

The scene renderer maps refs to visual elements.

## Limits

```ts
type TimelineLimits = {
  maxEvents: number;
  maxDurationMs: number;
  maxReads?: number;
  truncatedReason?: "event_cap" | "timeout" | "loop_guard" | "memory";
};
```

Default event cap target: 3,000 events for a UI-responsive replay.

## Minimal Sprint 1 example

```json
{
  "schemaVersion": "timeline.v0",
  "runId": "run_001",
  "questId": "timequake-boss",
  "caseId": "rotated-found-mid",
  "language": "python",
  "status": "passed",
  "passed": true,
  "expected": 4,
  "actual": 4,
  "budget": { "enabled": true, "limit": 30, "used": 7, "unit": "array_read", "exceeded": false },
  "summary": { "startedAt": "2026-09-30T00:00:00.000Z", "durationMs": 12, "eventCount": 5, "truncated": false },
  "input": { "structure": "array", "values": [4,5,6,7,0,1,2], "target": 0, "expectedIndex": 4 },
  "events": [
    { "i": 0, "t": 0, "kind": "line", "line": 3, "vars": { "l": 0, "r": 6 } },
    { "i": 1, "t": 1, "kind": "read", "line": 5, "ref": { "structure": "array", "name": "nums", "index": 3 }, "value": 7, "readCount": 1, "vars": { "l": 0, "mid": 3, "r": 6 } },
    { "i": 2, "t": 2, "kind": "read", "line": 5, "ref": { "structure": "array", "name": "nums", "index": 4 }, "value": 0, "readCount": 2, "vars": { "l": 4, "mid": 4, "r": 6 } },
    { "i": 3, "t": 3, "kind": "return", "line": 6, "functionName": "search", "value": 4 },
    { "i": 4, "t": 4, "kind": "outcome", "status": "passed", "expected": 4, "actual": 4, "message": "Found the target." }
  ],
  "limits": { "maxEvents": 3000, "maxDurationMs": 2000, "maxReads": 30 }
}
```