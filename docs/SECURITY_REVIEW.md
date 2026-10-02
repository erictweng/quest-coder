# Security Review — Trusted Climbing Stairs Slice

## Fixed boundaries

- `/api/run` is a validating HTTP proxy. It does not spawn Python or infer correctness, and runner failure produces `503` rather than a synthetic result.
- `/api/run` requires a session and checks quest prerequisites before anything is executed. Each session is limited to 30 runs a minute, one run in flight, and 20 seconds of runner time a minute, so a session submitting slow code cannot hold the runner's slots.
- New sessions are limited per caller address when `QUEST_CODER_TRUSTED_PROXY_HOPS` says how many proxies sit in front of the app. Without it `x-forwarded-for` is caller controlled and is ignored, and no shared cap is applied, because one caller could use it to lock everyone out. A surge of sign-ups instead triggers deletion of sessions that were never used and have been idle for an hour.
- Hints and solutions can only be opened for quests the player has unlocked.
- Runner output is strict JSON: non-finite and oversized numbers are returned as text and grade as wrong answers.
- Only the active pack and four challenge IDs are accepted. Unknown fields, modes, packs, challenge IDs, and traversal strings are rejected.
- The runner service requires a bearer token (compared in constant time) and caps request, execution time, stdout, and response size.
- The CLI resolves packs from fixed `runner/packs/` storage; callers cannot provide paths, tests, entrypoints, commands, or image names.
- Grading is separated from execution. Each case runs in a throwaway worker process that receives only the source and the case inputs; the grader process holds the expected values and decides the verdict.
- Hidden submit fixtures exist only in `runner/packs/`. They are excluded from both Next.js projections, client imports, and the pack API. Submit responses redact inputs, expected values, actual values, private case IDs, and error text (which is produced by submitted code).
- Solutions and hint text are not shipped to the browser. The server releases them on request and records that it did, so the assisted-clear reward penalty cannot be skipped by the client.
- Clears, rewards, and review schedules are written only by the server after a passing submit. The progress `PUT` accepts drafts and attempt history only.
- Anonymous sessions use opaque 256-bit tokens in HttpOnly, SameSite=Lax cookies; only token hashes are stored. Logging out does not delete the save.

## Defense in depth

The Python engine rejects imports, file APIs, dynamic execution, dunder access, and common network/process names. Each worker has a wall-clock guard, a hard kill, and best-effort CPU/address-space limits, and a whole submission has a 5.5 s deadline below the gateway's 7 s and the app's 8 s timeouts. These checks reduce exposure but are not a substitute for OS isolation.

## Known limits

- Workers share a filesystem and user with the grader, so pack files are readable by any code that defeats the source checks. Only OS-level isolation closes this.
- The rate limiters live in process memory, so they are per app instance. Someone creating many sessions can still multiply the per-session runner share, and without a trusted proxy a caller who also writes drafts into each session can grow the database. Put a rate-limiting proxy in front of a public deployment.
- The address-space limit on workers is not enforced on macOS, so memory is only bounded on Linux hosts.
- There are no accounts. A save cannot be recovered once its cookie is gone.

## Required production isolation

`runner/service/Dockerfile` and `compose.yaml` provide a non-root, read-only, capability-dropped deployment baseline. Public hosting must also provide:

- a dedicated runner host or microVM/container platform;
- outbound-deny firewall rules for execution workloads;
- TLS and source allowlisting between app and runner;
- provider-enforced CPU, memory, PID, and wall-time limits;
- bounded queueing and distributed rate limiting;
- token rotation and secret-backed configuration;
- no cloud credentials mounted into the execution container.

The local Python service is for development and private verification. It is not itself a hostile-code isolation boundary when run directly on a workstation.

## Verified security behavior

Automated tests prove:

- `return 999` fails through real execution;
- reference solutions pass server-owned submit suites;
- traversal and unknown fields are rejected;
- submit details are redacted;
- the browser receives no `tests.submit` projection;
- hidden-case error text is replaced, and workers never receive expected values;
- a non-terminating submit is classified as `loop_guard` inside the service deadline;
- unauthenticated runs are refused before execution;
- client-supplied clears, rewards, and help claims are ignored or rejected;
- an unavailable/misconfigured runner fails closed;
- progress is isolated behind an HttpOnly anonymous session.

## Remaining launch conditions

Before unrestricted public traffic:

1. Deploy and verify the runner in the hardened production container/microVM environment.
2. Replace local SQLite or mount a durable single-instance volume.
3. Add shared rate limiting/queueing for horizontally scaled deployments.
4. Run external abuse tests for network, filesystem, fork/PID, memory, CPU, timeout, oversized output, and cancellation behavior.
