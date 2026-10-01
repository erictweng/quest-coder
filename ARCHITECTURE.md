# Quest Coder Architecture

## MVP architecture summary

Quest Coder is a web app with a React/Next.js interface and a server-side CPython runner. The browser never executes player code. The runner returns structured results and a replay timeline; the browser renders that timeline into the RPG scene, code panel, read meter, and outcome visuals.

```text
Browser UI
  -> Next.js route/API boundary
    -> Runner adapter
      -> CPython sandbox process
        -> result + timeline JSON
    -> content/progress storage
  -> Replay renderer consumes timeline JSON
```

## Chosen stack

### App shell

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Package manager: npm for the initial skeleton

### Runner

- Python 3.11+ CPython service/process invoked from the server boundary.
- Sprint 1 can use a local process runner.
- Public launch requires hardened isolation before strangers can run code.

### Data

Sprint 1:

- Checked-in quest-pack fixtures.
- No accounts required.
- Attempt data can be local/in-memory while proving the engine.

Personal MVP:

- Postgres-backed persistence.
- Prisma or a thin SQL layer can be chosen when Sprint 4 starts.
- Store users, quest packs, progress, attempts, timeline pointers, review schedule, and reward ledger.

### Content

- Quest packs are JSON first.
- A validator runs reference solutions and schema checks before packs are loadable.
- Problem text, story, names, and visuals must be original.

## Runtime boundaries

### Browser boundary

The browser owns:

- Library browsing.
- Quest page and code editor.
- Submitting source code to the server boundary.
- Replay theater rendering.
- Local UI state and playback controls.

The browser must not:

- Run player Python.
- Trust client-generated pass/fail results.
- Require LeetCode/NeetCode text.

### Next.js server boundary

The server boundary owns:

- Loading validated quest packs.
- Accepting run submissions.
- Calling the runner adapter.
- Returning normalized run results.
- Later: auth, progress writes, attempt history, review scheduling, and rewards.

### Runner boundary

The runner owns:

- Syntax/compile classification.
- Test execution.
- Read-count wrappers.
- Line tracing and variable snapshots.
- Loop/time guard enforcement.
- Producing timeline events.
- Returning structured result types.

The runner should not know about React components, CSS, user accounts, or reward rules.

### Replay renderer boundary

The renderer owns:

- Mapping timeline events to frames.
- Scene-specific visuals: array doors/skyline, linked-list portals, trees, etc.
- Code highlighting.
- Variable tags.
- Read budget meter.
- Distinct visuals for pass, wrong answer, compile error, runtime crash, off-end read, loop guard, and over budget.

The renderer should not recalculate correctness.

## Sprint 1 runner flow

1. Receive source code, quest id, and selected test set.
2. Run a fast untraced pass/fail execution.
3. If needed for replay, run traced execution against the selected replay test.
4. Count reads with wrapped structures.
5. Enforce loop/time/read guards.
6. Normalize result into the timeline format.
7. Return the structured payload to the app.

## Result states

The app and runner must distinguish:

- `compile_error`
- `runtime_error`
- `wrong_answer`
- `passed`
- `over_budget`
- `loop_guard`
- `off_end_read`
- `internal_error`

## Security posture by milestone

### Sprint 1 local spike

Acceptable:

- Local-only runner.
- Hard-coded fixture packs.
- Basic process timeout.
- No public traffic.

Not acceptable for public use:

- Shared host execution without isolation.
- Network access from user code.
- Writable broad filesystem access.
- Unlimited CPU/memory/time.

### Public readiness

Before public users, require:

- Container or microVM isolation.
- No network from runner.
- Read-only filesystem plus scratch tempdir.
- CPU, memory, process, and wall-time limits.
- Queue/rate limits.
- Abuse tests.
- Timeline size caps and retention policy.

## Initial repository layout

```text
app/                         Next.js routes and UI shell
components/                  Reusable React components
content/packs/               JSON quest packs
lib/timeline/                Timeline types and renderer adapters
lib/quests/                  Pack loading helpers
runner/                      Python runner spike and tests
schemas/                     JSON schemas
scripts/                     Validation and dev scripts
docs/                        Contracts and planning docs
```

## Architectural rule of thumb

If code answers "did the user's program pass?", it belongs server-side or in the runner. If code answers "how should this run be shown?", it belongs in the replay renderer.