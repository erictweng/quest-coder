# Sprint 7 Smoke Tests

Sprint 7 hardens the MVP for public-readiness and documents the remaining production boundary.

## Milestone checklist

- [x] Container/microVM isolation strategy implemented.
  - Smoke: verifies `docs/SECURITY_REVIEW.md` describes the microVM/container launcher strategy and the API runner bridge carries `QUEST_CODER_PUBLIC_HARDENED`.
- [x] No-network, read-only filesystem, CPU/memory/time limits enforced.
  - Smoke: import and file-open attempts are rejected; runner has CPU/memory/time guards.
- [x] Rate limits and abuse protection.
  - Smoke: API route exposes source-size checks, fixed-window rate limits, HTTP 429, and `Retry-After`.
- [x] Queue visibility/progress while runs execute.
  - Smoke: API responses include active/queued/max concurrency and the UI shows Queue.
- [x] Timeline compression/storage retention policy.
  - Smoke: policy doc covers 3,000-event cap, compressed retention, TTL direction, and app stores compact attempt pointers.
- [x] Original-problem-text audit for all public packs.
  - Smoke: every pack has original text/art checklist flags.
- [x] Public signup/onboarding path.
  - Smoke: app exposes public onboarding copy, handle sign-in, and public-hardening profile.

## Acceptance checks

- [x] Sandbox security review passes documented checks.
- [x] Abuse tests cannot exhaust runner/API without hitting limits.
- [x] Public content does not copy LeetCode/NeetCode text.
- [x] Public sign-up works at planned MVP scale.

## Commands

```bash
npm run smoke:sprint7
```

Full Sprint 7 verification gate:

```bash
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint2
npm run smoke:sprint3
npm run smoke:sprint4
npm run smoke:sprint5
npm run smoke:sprint6
npm run smoke:sprint7
```
