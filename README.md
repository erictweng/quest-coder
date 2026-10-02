# Quest Coder

Quest Coder is a focused coding RPG. The current product ships one campaign—**Climbing Stairs / 1-DP**—as a four-stage learning path with a compiler-first workspace, Quest Notebook, basic checks, authoritative submits, replay animation, rewards, and durable anonymous progress.

## Current trusted slice

- Quest 1 teaches the recurrence.
- Quest 2 builds the bottom-up DP table.
- Quest 3 reduces state to two values.
- The Old Bramblehorn boss asks for the complete `climbStairs` solution.
- `Run basic` is feedback only.
- Only a passing `Submit all` clears a stage, grants its configured reward, and unlocks the next stage.
- `runner/packs/` is the single source of truth and the only place hidden submit tests live. `npm run build:packs` derives `content/server/` (for the Next.js server: no hidden tests) and `content/public/` (for the browser: additionally no solutions or hint text).
- The Next.js application never executes or infers Python results. It proxies to an authenticated runner service and fails closed when that service is unavailable.
- Running code requires a session. Each session gets a run count, one run at a time, and a share of runner time per minute.
- Hints are free unless the pack sets `rewards.xp.hintAssistedMultiplier`; revealing the solution scales the XP by `solutionAssistedMultiplier`. A boss rematch advances the review schedule only when the review is due.
- Clears, rewards, review schedules, opened hints and revealed solutions are decided and stored by the server. The browser only writes editor drafts and attempt history.

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

With Supabase configured, production sign-in uses passwordless email and progress is keyed by the immutable Supabase Auth user UUID in Postgres. With all Supabase variables absent, local/test mode keeps the existing opaque HttpOnly display-name session and `.data/quest-coder.sqlite` save. See `docs/SUPABASE_SETUP.md`.

## Verification gate

```bash
npm run lint          # tsc, including unused code
npm run test:packs    # pack projections are in sync with runner/packs
npm run test:unit     # progress store, rate limiter, client helpers
npm run test:runner   # Python engine and trust boundary
npx playwright install chromium
npm run test:e2e      # builds, then drives the production build
npm audit --omit=dev
```

`npm run test:trusted-slice` runs all of the above except the audit.

## Deployment model

- Deploy Next.js separately from the Python runner.
- Set server-only `QUEST_CODER_RUNNER_URL` and `QUEST_CODER_RUNNER_TOKEN` on the Next.js deployment.
- Deploy `runner/service/Dockerfile` behind TLS on an isolated runner host.
- Apply outbound-deny firewalling and provider-level CPU, memory, PID, filesystem, and timeout controls to the runner container/microVM.
- Never expose the runner token through `NEXT_PUBLIC_*` variables.
- Do not deploy durable SQLite on an ephemeral serverless filesystem; mount a durable volume or replace the repository with a managed database before multi-instance hosting.

See `docs/DEPLOYMENT.md`, `docs/SECURITY_REVIEW.md`, and `docs/TRUSTED_CLIMBING_STAIRS_SLICE.md`.
