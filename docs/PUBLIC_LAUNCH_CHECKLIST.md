# Public Launch Checklist

## Current launch level

**Private/link beta only. Search indexing remains disabled.** Repository checks are locally/CI verifiable, but Supabase setup, a rotated production private pack, external runner deployment, and provider-side release checks are still pending. Public launch is not ready.

## Verified in repository

- [x] Next.js no longer executes Python or uses regex grading.
- [x] Runner requests are strict, authenticated, and fail closed.
- [x] Hidden submit fixtures are absent from the public pack and redacted from responses.
- [x] Run is feedback-only; Submit controls progression and first-clear rewards.
- [x] Anonymous HttpOnly sessions and server-side local SQLite persistence exist.
- [x] Playwright completes all four Climbing Stairs stages and verifies reload persistence.
- [x] Dependencies and runtimes are pinned.
- [x] GitHub Actions runs typecheck, runner tests, build, Playwright, and audit.
- [x] Focused Chromium, Firefox, WebKit, and mobile Chromium smoke covers sign-in, personal save visibility, notebook keyboard close, editing, Run basic, and viewport overflow.
- [x] Axe covers the hub, solve screen, and open notebook with no WCAG category disabled.
- [x] Automated privacy checks inspect tracked packs, public projections, and production client chunks.
- [x] CI uploads uncommitted machine-readable provenance with SHA, runtimes, suite counts, and timestamp.
- [x] `robots.txt` blocks indexing unless explicitly enabled.

## Required before unrestricted public traffic

- [ ] Deploy `runner/service/Dockerfile` on a dedicated hardened runner host.
- [ ] Generate and mount a newly rotated private pack; never reuse the grading fixtures exposed in git history.
- [ ] Verify outbound network denial and read-only filesystem at the host/container layer.
- [ ] Verify CPU, memory, PID, output, and wall-time enforcement under abuse.
- [ ] Put runner traffic behind TLS, app allowlisting, and a rotated server-only token.
- [ ] Select durable managed persistence or a durable single-instance volume.
- [ ] Add distributed queue/rate limiting before horizontal scaling.
- [ ] Complete and verify the production Supabase project, migration, redirects, RLS, and service-role functions.
- [ ] Set `DEPLOYMENT_SMOKE_URL` and manually dispatch the safe deployment smoke against the real URL.
- [ ] Complete the authenticated successful-run, progress-isolation, mobile, replay, and completion checks in `docs/RELEASE_VERIFICATION.md`.

## Post-deploy functional checks

- [ ] `/api/health` reports the external runner ready.
- [ ] Correct Climbing Stairs solutions pass.
- [ ] `return 999`, starter stubs, syntax errors, and infinite loops do not clear progression.
- [ ] Run basic does not unlock the next stage.
- [ ] Submit all does unlock exactly one next stage.
- [ ] Hidden tests are absent from browser chunks and API payloads.
- [ ] Sign-in progress survives reload and cannot be read by another anonymous session.
- [ ] Runner unavailability produces a visible retryable error with no stale success state.

The unauthenticated deployment smoke checks HTTPS, health, headers, anonymous rejection, malformed/traversal rejection, and private-path unreachability without accepting or printing credentials. Successful submissions and Supabase ownership checks remain authenticated/manual by design.

## Rollback

If runner abuse, escapes, persistence loss, or resource exhaustion appears, disable or password-protect the deployment, preserve `main`, rotate the runner token, and keep indexing disabled until the isolation or durability issue is resolved.
