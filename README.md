# Quest Coder

Quest Coder turns algorithm practice into RPG quest packs: mini-quests, boss fights, visible code execution, replayable failures, spaced review, rewards, and optional social polish.

## Current status

The named MVP sprint plan is complete through Sprint 8. Sprint 9 prepares the public beta launch path.

Shipped core loop:

- Next.js app shell with local profile sign-in and saved progress.
- Python runner bridge with read budgets and replay timelines.
- Quest-pack JSON pipeline with validation.
- Five practice packs across binary search and linked lists.
- Review scheduler, per-topic stats, rewards, and optional friend shell.
- Public-hardening profile with rate limits, queue metadata, no-import/no-open source validation, and resource guards.

## Development

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Verification gate

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

## Deployment notes

- `vercel.json` is configured for the Next.js app and API routes.
- `/api/health` exposes launch-readiness metadata.
- `NEXT_PUBLIC_SITE_URL` should be set to the deployed URL.
- `NEXT_PUBLIC_ALLOW_INDEXING` defaults to blocked indexing; set to `true` only when ready for discovery.
- The local child-process Python runner is acceptable for a private beta smoke, but production launch should replace it with the container/microVM boundary described in `docs/SECURITY_REVIEW.md`.

## Source docs

- Sprint plan: `docs/SPRINTS_AND_MILESTONES.md`
- Deployment guide: `docs/DEPLOYMENT.md`
- Launch checklist: `docs/PUBLIC_LAUNCH_CHECKLIST.md`
- Security review: `docs/SECURITY_REVIEW.md`
- Timeline retention: `docs/TIMELINE_RETENTION_POLICY.md`
- Decisions: `DECISIONS.md`
- Architecture: `ARCHITECTURE.md`

## Discord thread

Project thread: `1555029357129506887`
