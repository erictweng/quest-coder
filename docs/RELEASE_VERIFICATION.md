# Release Verification

## Release state

The hardened slice is **locally/CI verifiable, not public-launch ready**. Public launch remains blocked until all provider-side items below are completed and evidenced:

- Supabase project, migration, passwordless redirect, RLS, and service-role function verification.
- A newly rotated production private runner pack created and stored outside git.
- The external runner deployed with TLS, app allowlisting, outbound deny, read-only filesystem, and provider resource limits.
- The production deployment smoke plus the authenticated/manual checks pass against the intended release URL.

## Repository verification

Use Node 24 and Python 3.11. Generated Playwright output and `artifacts/test-provenance.json` are ignored and must not be committed.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run lint
npm run test:packs
npm run test:unit
npm run test:runner
scripts/ci_runner_container.sh
npm run build
npm run test:privacy
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:accessibility
npm audit --omit=dev
npm run test:provenance -- --verified lint,packs,privacy,unit,runner,runner-container,build,chromium-full,chromium-smoke,firefox-smoke,webkit-smoke,mobile-chromium-smoke,axe,audit
```

Acceptance criteria:

- Every command exits zero.
- The full trusted-slice journey passes against the production build only in desktop Chromium.
- The focused sign-in/save/notebook/editor/Run/overflow smoke passes in Chromium, Firefox, WebKit, and mobile Chromium against the local development server. This avoids weakening production `Secure` cookies merely to accommodate HTTP-only browser automation.
- Axe reports zero WCAG A/AA violations on the hub, solve screen, and open Quest Notebook. There are currently **no rule exclusions**; any future exclusion must name a specific selector and documented product constraint, not disable a WCAG category.
- Privacy verification confirms the only tracked private-pack schema is the labeled fixture at `runner/tests/fixtures/non-production-private-pack.json`, public packs contain no solution/hint text/submit suite, and production client chunks contain no known server-only material.
- `artifacts/test-provenance.json` contains the current git SHA, UTC timestamp, Node/npm/Python versions, suite counts, and the verified suite list.

## Safe post-deployment smoke

Set the repository variable `DEPLOYMENT_SMOKE_URL` and manually dispatch **Deployment smoke**, or run:

```bash
npm run smoke:deployment -- https://app.example.com
```

Acceptance criteria:

- Non-local targets use HTTPS.
- `/api/health` reports `status: ok` and an available external runner.
- Required security headers are present.
- Anonymous `/api/run` is rejected.
- Malformed JSON and encoded traversal are rejected.
- Known private fixture/API/file paths are not reachable.
- The script receives no credentials, creates no account, and never prints secrets.

## Authenticated/manual provider verification

These checks are intentionally separate because the safe smoke never accepts credentials or submits user code:

1. Complete `docs/SUPABASE_SETUP.md`; verify magic-link redirect, immutable Auth UUID ownership, RLS cross-user isolation, and service-role-only progress mutations.
2. Mount a newly rotated production private pack and verify the runner starts only with that valid read-only mount.
3. From a dedicated test account, run a correct solution and confirm Run basic does not clear while Submit all clears exactly one stage.
4. Submit incorrect, syntax-error, infinite-loop, and traversal/malformed attempts; confirm no clear and no private data in responses or browser chunks.
5. Reload and sign in from a second account; confirm progress durability and isolation.
6. Make the runner unavailable; confirm a retryable error and no stale success UI.
7. Record the deployment URL, app git SHA, runner image digest, private-pack rotation identifier (not contents), Supabase migration version, smoke output, and manual tester/date in the release ticket.

Public launch is not ready until every manual item above passes on the actual providers.
