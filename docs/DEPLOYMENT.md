# Quest Coder Deployment Guide

Sprint 9 prepares Quest Coder for a public beta deployment.

## Recommended target

Use Vercel for the Next.js app shell and API bridge for the first beta. The repo includes `vercel.json` with:

- Next.js framework preset.
- `npm run build` build command.
- `/api/run` max duration set to 10 seconds.
- Basic browser hardening headers.

## Environment variables

Set these in the deployment provider:

```text
NEXT_PUBLIC_SITE_URL=https://<deployed-url>
NEXT_PUBLIC_ALLOW_INDEXING=false
NEXT_PUBLIC_APP_VERSION=<git-sha-or-release-label>
```

Optional server-side runner setting:

```text
QUEST_CODER_PYTHON=/usr/bin/python3
```

Notes:

- `/api/run` spawns a Python 3 child process. It resolves the interpreter from `QUEST_CODER_PYTHON` first, then tries `python3`, `python`, and the usual macOS/Linux install paths (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`) even when the server's own `PATH` is minimal. If none work the UI shows a "Python 3 runtime not found" message instead of a raw `spawn python3 ENOENT`.
- Hosted runtimes without a Python binary (for example plain Vercel Node functions) must either provide one or set `QUEST_CODER_PYTHON` to an interpreter that exists in the deployed image. `/api/health` reports the resolved interpreter under `runner.python`.
- `NEXT_PUBLIC_*` values are public in the browser bundle. Do not put secrets there.
- Keep `NEXT_PUBLIC_ALLOW_INDEXING=false` during private/link beta.
- Flip indexing only after the public content and sandbox boundary are final.

## Deployment command path

Local verification before deploy:

```bash
npm install
npm run test:runner
npm run typecheck
npm run build
npm run smoke:sprint9
```

Provider setup:

1. Import `https://github.com/erictweng/quest-coder` into Vercel.
2. Use branch `main`.
3. Build command: `npm run build`.
4. Install command: `npm install`.
5. Set the env vars above.
6. Deploy.
7. Read back:
   - `/`
   - `/api/health`
   - `/robots.txt`
   - `/sitemap.xml`

## Public beta caveat

The Sprint 7 hardening gate blocks common dangerous Python capabilities and adds API abuse controls. For a full public launch, replace the local Python child process with a short-lived container or microVM runner while preserving the current JSON stdin/stdout contract.
