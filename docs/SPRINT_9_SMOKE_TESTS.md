# Sprint 9 Smoke Tests

Sprint 9 prepares Quest Coder for a public beta launch.

## Milestone checklist

- [x] Deployment target configuration.
  - Smoke: `npm run smoke:sprint9` checks `vercel.json`, build command, API function limits, and security headers.
- [x] Public launch checklist.
  - Smoke: checks `docs/PUBLIC_LAUNCH_CHECKLIST.md` includes required pre-share, post-deploy, announcement, and rollback sections.
- [x] Health/readiness endpoint.
  - Smoke: checks `/api/health` route reports status, launch stage, pack count, runner profile, and version metadata.
- [x] SEO/indexing controls.
  - Smoke: checks `robots.ts`, `sitemap.ts`, metadata base URL, and `NEXT_PUBLIC_ALLOW_INDEXING` default-off behavior.
- [x] Launch docs and rollback plan.
  - Smoke: checks `docs/DEPLOYMENT.md` and launch checklist include provider setup, env vars, and rollback path.
- [x] Final full-sprint verification gate.
  - Smoke: checks README documents the Sprint 2–9 gate.

## Acceptance checks

- [x] App has repeatable deployment instructions and provider config.
- [x] `/api/health` reports launch-readiness metadata.
- [x] Indexing is blocked by default and explicitly configurable.
- [x] Launch checklist covers post-deploy smoke checks and rollback.
- [x] Full Sprint 2–9 gate passes locally before deploy.

## Commands

```bash
npm run smoke:sprint9
```

Full Sprint 9 verification gate:

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
npm run smoke:sprint8
npm run smoke:sprint9
```
