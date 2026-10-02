# Quest Coder

Quest Coder is a focused coding RPG. The current product ships one campaign—**Climbing Stairs / 1-DP**—as a four-stage learning path with a compiler-first workspace, Quest Notebook, basic checks, authoritative submits, replay animation, rewards, and durable anonymous progress.

## Current trusted slice

- Quest 1 teaches the recurrence.
- Quest 2 builds the bottom-up DP table.
- Quest 3 reduces state to two values.
- The Old Bramblehorn boss asks for the complete `climbStairs` solution.
- `Run basic` is feedback only.
- Only a passing `Submit all` clears a stage, grants its configured reward, and unlocks the next stage.
- Submit fixtures stay in `runner/packs/`; the browser receives only the public projection in `content/public/`.
- The Next.js application never executes or infers Python results. It proxies to an authenticated runner service and fails closed when that service is unavailable.

## Local development

Requires Node 24+ and Python 3.11+.

```bash
npm ci
cp .env.example .env.local
# terminal 1
QUEST_CODER_RUNNER_TOKEN=replace-with-a-long-random-value npm run runner:service
# terminal 2
npm run dev
```

The same `QUEST_CODER_RUNNER_TOKEN` must be present in `.env.local` and the runner process.

Local sign-in creates an opaque HttpOnly session and stores progress in `.data/quest-coder.sqlite`. If the session API is unavailable, the client retains a localStorage fallback rather than losing existing prototype progress.

## Verification gate

```bash
npm run typecheck
npm run test:runner
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

Playwright verifies the real journey: wrong submit, Run-without-unlock, Submit unlocks, all four stages, final campaign completion, hidden fixture redaction, session persistence, and reward totals.

## Deployment model

- Deploy Next.js separately from the Python runner.
- Set server-only `QUEST_CODER_RUNNER_URL` and `QUEST_CODER_RUNNER_TOKEN` on the Next.js deployment.
- Deploy `runner/service/Dockerfile` behind TLS on an isolated runner host.
- Apply outbound-deny firewalling and provider-level CPU, memory, PID, filesystem, and timeout controls to the runner container/microVM.
- Never expose the runner token through `NEXT_PUBLIC_*` variables.
- Do not deploy durable SQLite on an ephemeral serverless filesystem; mount a durable volume or replace the repository with a managed database before multi-instance hosting.

See `docs/DEPLOYMENT.md`, `docs/SECURITY_REVIEW.md`, and `docs/TRUSTED_CLIMBING_STAIRS_SLICE.md`.
