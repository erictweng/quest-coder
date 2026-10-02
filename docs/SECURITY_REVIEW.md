# Security Review — Trusted Climbing Stairs Slice

## Fixed boundaries

- `/api/run` is now a validating HTTP proxy. It does not spawn Python or infer correctness.
- `lib/climbing-stairs-fallback.ts` is no longer reachable from grading. Runner failure produces `503` rather than a synthetic pass/fail result.
- Only the active pack and four challenge IDs are accepted. Unknown fields, modes, packs, challenge IDs, and traversal strings are rejected.
- The runner service requires a bearer token and caps request, execution time, stdout, and response size.
- The CLI resolves packs from fixed `runner/packs/` storage; callers cannot provide paths, tests, entrypoints, commands, or image names.
- Hidden submit fixtures are excluded from `content/public/`, client imports, and the pack API. Submit responses redact inputs, expected values, actual values, and private case IDs.
- Anonymous sessions use opaque 256-bit tokens in HttpOnly, SameSite=Lax cookies; only token hashes are stored.

## Defense in depth

The Python engine still rejects imports, file APIs, dynamic execution, dunder access, and common network/process names. It applies per-case time guards plus best-effort CPU/address-space limits. Those checks reduce exposure but are not a substitute for OS isolation.

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
- an unavailable/misconfigured runner fails closed;
- progress is isolated behind an HttpOnly anonymous session.

## Remaining launch conditions

Before unrestricted public traffic:

1. Deploy and verify the runner in the hardened production container/microVM environment.
2. Replace local SQLite or mount a durable single-instance volume.
3. Add shared rate limiting/queueing for horizontally scaled deployments.
4. Run external abuse tests for network, filesystem, fork/PID, memory, CPU, timeout, oversized output, and cancellation behavior.
