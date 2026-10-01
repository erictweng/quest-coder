# Sprint 7 Security Review

Quest Coder is still a local MVP, but Sprint 7 defines and enforces the first public-readiness safety envelope.

## Public-hardening-v0 controls

- **Container/microVM strategy:** production should run `runner/quest_runner_cli.py` inside a per-run Firecracker/microVM or equivalent short-lived container with this same stdin/stdout JSON contract. The app bridge already treats the runner as an isolated child process, so the process boundary can be swapped for a container launcher without changing pack content.
- **No network:** public source validation rejects imports and network-related names such as `socket`, `subprocess`, `os`, and `sys`. The runner namespace does not expose `__import__`.
- **Read-only filesystem:** public source validation rejects `open`, `compile`, `eval`, `exec`, and dunder access. The runner namespace does not expose file APIs.
- **CPU/time limits:** the API kills the runner bridge after 7s; the Python runner also applies a per-case wall-time guard and best-effort `RLIMIT_CPU`.
- **Memory limits:** the Python runner applies best-effort `RLIMIT_AS` at 256MB.
- **Abuse protection:** `/api/run` limits source size, applies per-client fixed-window rate limits, and runs through a small concurrency queue.
- **Queue visibility:** API responses include `{ activeRuns, queuedRuns, maxConcurrentRuns }`, and the app shows queue status.
- **Timeline retention:** replays remain capped at 3,000 events. The UI stores only compressed run metadata and capped replay pointers in localStorage for the MVP.

## Documented security checks

- Import attempt is blocked before execution.
- File-open attempt is blocked before execution.
- Oversized source is rejected before runner spawn.
- Rate-limit code path returns HTTP 429 with `Retry-After`.
- Runner still passes reference solutions under the hardened namespace.
- Full Sprint 2–7 smoke gate passes after hardening.

## Known limits before real public launch

- The local child-process runner is not a true isolation boundary by itself.
- Production must replace the child process with the container/microVM launcher described above.
- Rate limiting is in-memory and should move to Redis or provider edge limits before multi-instance deploy.
- User/profile storage is localStorage MVP state, not production identity.
