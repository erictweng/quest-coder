# Quest Coder

Quest Coder is a focused coding RPG. The current product ships one campaign—**Climbing Stairs / 1-DP**—as a four-stage learning path with a compiler-first workspace, Quest Notebook, basic checks, authoritative submits, replay animation, rewards, and durable anonymous progress.

## Current trusted slice

- Quest 1 teaches the recurrence.
- Quest 2 builds the bottom-up DP table.
- Quest 3 reduces state to two values.
- The Old Bramblehorn boss asks for the complete `climbStairs` solution.
- `Run basic` is feedback only.
- Only a passing `Submit all` clears a stage, grants its configured reward, and unlocks the next stage.
- `content/server/` is the tracked source for public Run content; `npm run build:packs` derives the browser-redacted `content/public/` projection. Authoritative Submit fixtures are never tracked or copied into the image: the runner requires a mounted file through `QUEST_CODER_PRIVATE_PACK_PATH`.
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
QUEST_CODER_RUNNER_TOKEN=replace-with-a-long-random-value \
QUEST_CODER_PRIVATE_PACK_PATH=$PWD/runner/tests/fixtures/non-production-private-pack.json \
npm run runner:service
# terminal 2
npm run dev
```

The committed fixture is labeled **NON-PRODUCTION** and exists only for CI/E2E/local wiring. Before production, generate a skeleton with `npm run private-pack:generate -- .private/runner-packs/forest-of-patience-climbing-stairs.json`, add newly rotated private cases out of band, then validate it with `npm run private-pack:validate -- <path>`. The historical repository exposed the old fixtures, so reusing them is not safe.

With Supabase configured, production sign-in uses passwordless email and progress is keyed by the immutable Supabase Auth user UUID in Postgres. With all Supabase variables absent, local/test mode keeps the existing opaque HttpOnly display-name session and `.data/quest-coder.sqlite` save. See `docs/SUPABASE_SETUP.md`.

## Verification gate

```bash
npm run lint          # tsc, including unused code
npm run test:packs    # public projection matches content/server
npm run test:unit     # progress store, rate limiter, client helpers
npm run test:runner   # Python engine and trust boundary
npm run build         # production client/server build
npm run test:privacy  # tracked packs, public projections, client chunks
npx playwright install chromium firefox webkit
npm run test:e2e                # full desktop Chromium trusted slice
npm run test:e2e:smoke          # focused Chromium/Firefox/WebKit/mobile matrix
npm run test:e2e:accessibility  # axe on hub, solve screen, and notebook
npm audit --omit=dev
```

`npm run test:trusted-slice` runs the repository checks above except the runner-container check and audit. CI also uploads machine-readable test provenance containing the git SHA, runtime versions, suite counts, and timestamp. Generated evidence is ignored rather than committed.

## Release state

- **Locally/CI verified:** pack projection, privacy boundary, unit/runner/container behavior, production build, full Chromium journey, focused Chromium/Firefox/WebKit/mobile smoke, and axe checks.
- **Supabase setup pending:** the project, migration, redirects, RLS, and service-role functions must be verified on the chosen provider.
- **Private production fixture pending:** create a newly rotated pack outside git; the committed fixture is non-production only.
- **External runner deployment pending:** prove TLS, allowlisting, outbound deny, read-only storage, and provider resource limits.
- **Public launch not ready:** the safe deployment smoke and authenticated/manual provider checks must pass against the real release URL.

## Deployment model

- Deploy Next.js separately from the Python runner.
- Set server-only `QUEST_CODER_RUNNER_URL` and `QUEST_CODER_RUNNER_TOKEN` on the Next.js deployment.
- Deploy `runner/service/Dockerfile` behind TLS on an isolated runner host.
- Mount a rotated private pack read-only and set `QUEST_CODER_PRIVATE_PACK_PATH`; startup fails closed when it is absent or invalid.
- Apply outbound-deny firewalling and provider-level CPU, memory, PID, filesystem, and timeout controls to the runner container/microVM.
- Never expose the runner token through `NEXT_PUBLIC_*` variables.
- Do not deploy durable SQLite on an ephemeral serverless filesystem; mount a durable volume or replace the repository with a managed database before multi-instance hosting.

See `docs/PRIVATE_RUNNER_PACK.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY_REVIEW.md`, `docs/RELEASE_VERIFICATION.md`, and `docs/TRUSTED_CLIMBING_STAIRS_SLICE.md`.
