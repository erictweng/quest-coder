# Quest Coder Deployment Guide

## Topology

Quest Coder now uses two explicit services:

1. **Next.js application** — UI, Supabase SSR authentication, progress API, and the authenticated `/api/run` proxy. Local development falls back to an anonymous cookie and SQLite.
2. **Python runner service** — owns private tests and performs real CPython execution.

The Next.js process never executes Python and never fabricates grading results. If the runner is unreachable, `/api/run` returns a fail-closed `503 runner_unavailable` response.

## Local setup

```bash
npm ci
cp .env.example .env.local
QUEST_CODER_RUNNER_TOKEN=<same-local-token> \
QUEST_CODER_PRIVATE_PACK_PATH=$PWD/runner/tests/fixtures/non-production-private-pack.json \
npm run runner:service
npm run dev
```

The default local data path is `.data/quest-coder.sqlite`. It is suitable for local/private single-instance use.

## Next.js environment

```text
QUEST_CODER_RUNNER_URL=https://<runner-host>
QUEST_CODER_RUNNER_TOKEN=<server-only-random-secret>
QUEST_CODER_DATABASE_PATH=/durable-volume/quest-coder.sqlite
NEXT_PUBLIC_SITE_URL=https://<app-host>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
NEXT_PUBLIC_ALLOW_INDEXING=false
NEXT_PUBLIC_APP_VERSION=<git-sha>
QUEST_CODER_TRUSTED_PROXY_HOPS=1
```

Set `QUEST_CODER_TRUSTED_PROXY_HOPS` to the number of proxies you run in front of the app (1 for a single load balancer or platform edge). It enables per-address sign-up limits. Leave it at 0 when the app is reached directly, because the forwarded header is then caller controlled.

Never put the runner token or service-role key in a `NEXT_PUBLIC_*` variable. The Supabase URL and publishable key are intentionally public; the service-role key is not.

Apply the idempotent migration and configure passwordless email redirects by following `docs/SUPABASE_SETUP.md`.

Use `npm ci`, not `npm install`, for reproducible deployment from the lockfile.

## Runner deployment

Build from `runner/service/Dockerfile`. Its Python base is pinned by registry digest and explicit `COPY` paths omit `runner/tests/fixtures`. `compose.yaml` demonstrates a read-only container, non-root user, dropped capabilities, no-new-privileges, PID/memory/CPU limits, a bounded tmpfs, an internal network, and a read-only secret mount. CI builds and starts this image and verifies those boundaries.

`QUEST_CODER_PRIVATE_PACK_PATH` is mandatory. For Compose, set `QUEST_CODER_PRIVATE_PACK_FILE` to a host-side rotated pack; Compose mounts it at `/run/secrets/quest_coder_private_pack`. The runner exits before listening if the file is absent or invalid.

The historical git repository exposed the previous grading pack. **Do not reuse it in production.** Generate a case-free skeleton under ignored storage, add newly rotated private cases out of band, and validate it:

```bash
npm run private-pack:generate -- .private/runner-packs/forest-of-patience-climbing-stairs.json
npm run private-pack:validate -- .private/runner-packs/forest-of-patience-climbing-stairs.json
```

See `docs/PRIVATE_RUNNER_PACK.md` for the complete schema and replay/public-case rule.

Before public traffic, the runner host must additionally enforce:

- TLS between the app and runner.
- Firewall allowlisting for the app deployment.
- Outbound network deny for execution workloads.
- Durable provider-level CPU, memory, process, and wall-time limits.
- Log redaction and token rotation.
- An external/shared queue and rate limiter if more than one runner instance is used.

The Python AST restrictions remain defense-in-depth; they are not the isolation boundary.

## Persistence

Production identity comes from Supabase Auth and progress rows are keyed by the immutable Auth user UUID. Authoritative mutations run through service-role-only, row-locking database functions. RLS prevents cross-user reads and browser writes.

When all Supabase variables are absent, local/test mode uses an opaque random token stored in an HttpOnly, SameSite=Lax cookie. Only its SHA-256 hash is stored. Progress is stored server-side in SQLite. Logging out keeps the save; signing in again on the same browser resumes it. Sessions idle for more than 400 days are deleted.

Do not set a partial Supabase configuration: startup and requests fail closed rather than silently selecting the wrong identity backend. Do not use the SQLite fallback on Vercel or another ephemeral/multi-instance production host.

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
