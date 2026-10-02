# Public Launch Checklist

## Current launch level

**Private/link beta only. Search indexing remains disabled.** The application now has a trusted vertical-slice contract, but unrestricted public traffic still requires deployment-time sandbox and durable-database proof.

## Verified in repository

- [x] Next.js no longer executes Python or uses regex grading.
- [x] Runner requests are strict, authenticated, and fail closed.
- [x] Hidden submit fixtures are absent from the public pack and redacted from responses.
- [x] Run is feedback-only; Submit controls progression and first-clear rewards.
- [x] Anonymous HttpOnly sessions and server-side local SQLite persistence exist.
- [x] Playwright completes all four Climbing Stairs stages and verifies reload persistence.
- [x] Dependencies and runtimes are pinned.
- [x] GitHub Actions runs typecheck, runner tests, build, Playwright, and audit.
- [x] `robots.txt` blocks indexing unless explicitly enabled.

## Required before unrestricted public traffic

- [ ] Deploy `runner/service/Dockerfile` on a dedicated hardened runner host.
- [ ] Verify outbound network denial and read-only filesystem at the host/container layer.
- [ ] Verify CPU, memory, PID, output, and wall-time enforcement under abuse.
- [ ] Put runner traffic behind TLS, app allowlisting, and a rotated server-only token.
- [ ] Select durable managed persistence or a durable single-instance volume.
- [ ] Add distributed queue/rate limiting before horizontal scaling.
- [ ] Run the post-deploy Playwright smoke against the real URL.
- [ ] Manually check mobile editor, Quest Notebook, replay, and completion flow.

## Post-deploy functional checks

- [ ] `/api/health` reports the external runner ready.
- [ ] Correct Climbing Stairs solutions pass.
- [ ] `return 999`, starter stubs, syntax errors, and infinite loops do not clear progression.
- [ ] Run basic does not unlock the next stage.
- [ ] Submit all does unlock exactly one next stage.
- [ ] Hidden tests are absent from browser chunks and API payloads.
- [ ] Sign-in progress survives reload and cannot be read by another anonymous session.
- [ ] Runner unavailability produces a visible retryable error with no stale success state.

## Rollback

If runner abuse, escapes, persistence loss, or resource exhaustion appears, disable or password-protect the deployment, preserve `main`, rotate the runner token, and keep indexing disabled until the isolation or durability issue is resolved.
