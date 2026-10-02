# Quest Coder Deployment Guide

## Topology

Quest Coder now uses two explicit services:

1. **Next.js application** — UI, anonymous session cookie, progress API, and the authenticated `/api/run` proxy.
2. **Python runner service** — owns private tests and performs real CPython execution.

The Next.js process never executes Python and never fabricates grading results. If the runner is unreachable, `/api/run` returns a fail-closed `503 runner_unavailable` response.

## Local setup

```bash
npm ci
cp .env.example .env.local
QUEST_CODER_RUNNER_TOKEN=<same-local-token> npm run runner:service
npm run dev
```

The default local data path is `.data/quest-coder.sqlite`. It is suitable for local/private single-instance use.

## Next.js environment

```text
QUEST_CODER_RUNNER_URL=https://<runner-host>
QUEST_CODER_RUNNER_TOKEN=<server-only-random-secret>
QUEST_CODER_DATABASE_PATH=/durable-volume/quest-coder.sqlite
NEXT_PUBLIC_SITE_URL=https://<app-host>
NEXT_PUBLIC_ALLOW_INDEXING=false
NEXT_PUBLIC_APP_VERSION=<git-sha>
QUEST_CODER_TRUSTED_PROXY_HOPS=1
```

Set `QUEST_CODER_TRUSTED_PROXY_HOPS` to the number of proxies you run in front of the app (1 for a single load balancer or platform edge). It enables per-address sign-up limits. Leave it at 0 when the app is reached directly, because the forwarded header is then caller controlled.

Never put the runner token or database credentials in a `NEXT_PUBLIC_*` variable.

Use `npm ci`, not `npm install`, for reproducible deployment from the lockfile.

## Runner deployment

Build from `runner/service/Dockerfile`. `compose.yaml` demonstrates a read-only container, non-root user, dropped capabilities, no-new-privileges, PID/memory/CPU limits, a bounded tmpfs, and an internal network with no route out. Because that network is internal, the runner has no published host port: the app must join `runner_net` and use `http://runner:8787`. The compose file has not been exercised in CI.

Before public traffic, the runner host must additionally enforce:

- TLS between the app and runner.
- Firewall allowlisting for the app deployment.
- Outbound network deny for execution workloads.
- Durable provider-level CPU, memory, process, and wall-time limits.
- Log redaction and token rotation.
- An external/shared queue and rate limiter if more than one runner instance is used.

The Python AST restrictions remain defense-in-depth; they are not the isolation boundary.

## Persistence

Anonymous sessions use an opaque random token stored in an HttpOnly, SameSite=Lax cookie. Only its SHA-256 hash is stored. Progress is stored server-side in SQLite, which is the only copy. Logging out keeps the save; signing in again on the same browser resumes it. Sessions idle for more than 400 days are deleted.

Do not use SQLite on Vercel's ephemeral filesystem for a multi-instance deployment. Either:

- deploy Next.js on a host with a durable mounted volume and one app instance; or
- replace `lib/progress-store.ts` with a managed Postgres/libSQL repository before scaling.

## Verification

```bash
npm ci
npm run lint
npm run test:packs
npm run test:unit
npm run test:runner
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

After deployment, verify `/api/health`, a correct submission, an incorrect `return 999` submission, blocked/traversal input, hidden-case redaction, progress after reload, and runner-unavailable behavior.
