# Quest Coder Architecture

## Current vertical slice

Quest Coder currently exposes one campaign: **Forest of Patience — Climbing Stairs**. It contains three learning quests and one final boss. The browser never executes or grades Python.

```text
Browser
  -> Next.js UI and API
       -> Supabase Auth identity + Postgres progress (production)
       -> anonymous HttpOnly session + SQLite progress (local fallback)
       -> authenticated HTTP runner client
            -> isolated runner service
                 -> strict pack/challenge lookup
                 -> CPython grading process
                 -> normalized result and replay timeline
```

## Runtime boundaries

### Browser

The browser owns the editor, Quest Notebook, result presentation, replay rendering, and optimistic UI state. It receives only the public content projection under `content/public/`.

It must not:

- execute or infer Python correctness;
- receive private submit fixtures or expected values;
- grant authoritative clears or rewards;
- unlock a stage after `Run basic`.

### Next.js

Next.js owns:

- request validation through `lib/run-contract.ts`;
- authenticated calls to `QUEST_CODER_RUNNER_URL`;
- Supabase SSR cookie authentication with server-side `auth.getUser()` verification in production;
- Supabase Postgres progress keyed by immutable Auth user UUID in production;
- anonymous session cookies and SQLite-backed progress only when Supabase is not configured;
- authoritative, idempotent clear and reward writes after passing Submit responses;
- public pack delivery and runner readiness reporting.

`app/api/run/route.ts` never spawns Python and has no grading fallback. Runner failure returns a structured unavailable/timeout response and fails closed.

### Runner service

`runner/service/app.py` is deployed separately from Next.js. It owns:

- bearer authentication;
- strict allowlists for pack, challenge, mode, and request fields;
- request, response, concurrency, and wall-time limits;
- launching the CPython grading process with a minimal environment;
- redacting private Submit arguments and expected values;
- health and readiness endpoints.

The runner maps IDs to fixtures under `runner/packs/`; callers cannot provide paths, commands, tests, entrypoints, or images.

For hosted execution, run the supplied container with an outbound-denied network, read-only root filesystem, dropped capabilities, non-root user, limited scratch space, PID limit, CPU limit, and memory limit. A stronger microVM/per-run-container provider remains required before unrestricted multi-tenant public traffic.

### Identity and progress repository

Production requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. Passwordless email links establish Supabase SSR cookies. API authorization verifies those cookies with `auth.getUser()`; display names are presentation only and never progress keys.

The `ProgressStore` facade selects Supabase only when all three variables are present. Supabase mutations call service-role-only functions in the `quest_coder` schema. Each function creates/locks the user's row before applying an atomic mutation. RLS keys browser reads to `auth.uid()` and browser roles receive no write grants. Drafts use per-challenge revisions and attempts merge by attempt ID, so a delayed tab cannot replace a newer map or erase authoritative progress.

Credential-free local mode uses:

- random opaque session tokens;
- SHA-256 token hashes in SQLite;
- `HttpOnly`, `SameSite=Lax` cookies;
- server-owned clears, reviews, and reward totals;
- client-owned drafts and presentation history merged without allowing the client to overwrite authoritative fields.

SQLite mutations run under `BEGIN IMMEDIATE`, enable foreign keys, and explicitly remove orphan rows during cleanup.

The default local database lives under `.data/`, which is ignored. It is a fallback for tests/local development, not production deployment storage.

## Content separation

- `content/public/forest-of-patience-climbing-stairs.json`: prompts, examples, hints, starter/reference code, public Run cases, and replay metadata.
- `runner/packs/forest-of-patience-climbing-stairs.json`: full server-owned Run/Submit grading material.

A post-build scan must confirm hidden case IDs and expected values do not occur in `.next/static`.

## Progression contract

1. `Run basic` uses public cases and is feedback-only.
2. Only a passing `Submit all` may clear a stage.
3. A first clear grants the configured reward once.
4. Each clear unlocks exactly the next stage.
5. Completed stages remain replayable.
6. The final boss produces campaign completion and returns to Campaign.
7. Refresh restores the session, clears, attempts, drafts, and rewards.

## Result contract

The UI and runner distinguish:

- `compile_error`
- `runtime_error`
- `wrong_answer`
- `passed`
- `over_budget`
- `loop_guard`
- `off_end_read`
- `internal_error`
- boundary failures such as `runner_unavailable`, `runner_timeout`, and `queue_full`

Each visible failure provides a diagnosis and one next action without exposing the full solution.

## Repository layout

```text
app/                 Next.js UI and API routes
components/          Extracted result and completion UI
content/public/      Browser pack projection: no hidden tests, solutions or hint text
content/server/      Next.js server pack projection: no hidden tests
lib/                 contracts, runner client, progress repository
runner/packs/        pack source of truth, including private grading fixtures
runner/service/      separately deployable HTTP gateway
runner/tests/        execution and boundary tests
scripts/             pack projection generator
tests/unit/          progress store, rate limiter and client helper tests
tests/e2e/           Playwright behavior tests against the production build
.github/workflows/   release gate
```

## Release gates

- TypeScript typecheck, including unused code
- pack projections in sync with `runner/packs/`
- unit tests
- Python runner tests
- production build
- Playwright trusted-slice journey
- dependency audit
- hidden-fixture scan

If code answers “did the submitted program pass?”, it belongs behind the runner boundary. If code answers “how should the run be shown?”, it belongs in the UI.
