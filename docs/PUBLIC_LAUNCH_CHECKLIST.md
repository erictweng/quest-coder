# Public Launch Checklist

Sprint 9 launch checklist for Quest Coder.

## Launch level

Current target: **public beta / link-shareable**, not search-indexed by default.

## Required before sharing

- [x] Main branch pushed to GitHub.
- [x] Production build passes.
- [x] Full sprint smoke gate passes through Sprint 9.
- [x] `/api/health` returns launch metadata.
- [x] `robots.txt` blocks indexing unless `NEXT_PUBLIC_ALLOW_INDEXING=true`.
- [x] `sitemap.xml` uses `NEXT_PUBLIC_SITE_URL`.
- [x] Public hardening profile is documented.
- [x] Original-problem-text checklist exists on every pack.
- [x] Security caveat is documented: local child-process runner must become container/microVM for unrestricted public traffic.

## Manual post-deploy checks

After Vercel or another provider returns a URL:

- [ ] Open `/` and sign in with a test handle.
- [ ] Run a passing Timequake solution.
- [ ] Confirm `/api/run` returns queue and security metadata.
- [ ] Confirm `/api/health` returns `status: ok` and the expected pack count.
- [ ] Confirm `/robots.txt` matches the intended indexing setting.
- [ ] Confirm `/sitemap.xml` uses the deployed URL.
- [ ] Try blocked source: `import os` should fail with the public-disabled capability message.
- [ ] Check mobile width for library/editor/replay usability.

## Launch announcement draft

Quest Coder public beta is live: practice algorithms as RPG quest packs with boss fights, replayable code execution, visual data-structure scenes, spaced review, rewards, and optional social polish.

## Rollback

If runner abuse, crashes, or provider resource issues appear:

1. Disable or password-protect the deployment.
2. Keep GitHub main intact.
3. File the blocker under Sprint 10 or hotfix.
4. Replace the child-process runner with the container/microVM runner before reopening broad public access.
