# Supabase Setup for Quest Coder

Production uses Supabase Auth for identity and Supabase Postgres for progress. When all Supabase variables are absent, Quest Coder keeps the credential-free local SQLite/display-name flow used by tests and local development. Partial Supabase configuration is rejected.

## 1. Create and configure the project

1. Create a Supabase project.
2. In **Authentication → URL Configuration**, set the Site URL to the deployed Quest Coder URL.
3. Add redirect URLs for:
   - `https://<production-host>/auth/callback`
   - `http://localhost:3000/auth/callback` for local Supabase testing
4. Enable email passwordless sign-in. Quest Coder calls `signInWithOtp` and supports both PKCE `code` callbacks and `token_hash` confirmation links.
5. In **API Settings**, add `quest_coder` to the exposed schemas. The application invokes only service-role RPCs in this schema; the browser does not receive the service-role key.

## 2. Apply the database migration

Apply `supabase/migrations/202610020001_quest_coder_auth_progress.sql` through the Supabase CLI or SQL editor. It is idempotent and creates:

- `quest_coder.progress`, keyed by `auth.users.id` UUID with `ON DELETE CASCADE`;
- RLS with an authenticated read-own-row policy keyed to `auth.uid()`;
- revoked browser writes;
- service-role-only RPCs for reads, merged client saves, help state, shop spending, and authoritative clears/rewards;
- row locks (`SELECT ... FOR UPDATE`) around every mutation so autosave/help/submit concurrency cannot erase clears or double-grant rewards.

The RPCs are deliberately Quest Coder-scoped. Do not grant their execution to `anon` or `authenticated`.

## 3. Set production environment variables

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=https://<production-host>
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never rename it with a `NEXT_PUBLIC_` prefix, place it in client code, commit it, or expose it in logs.

The existing runner variables are still required. `QUEST_CODER_DATABASE_PATH` is ignored in Supabase mode and remains available only for local SQLite fallback.

## 4. Email template options

The normal PKCE magic-link flow redirects to `/auth/callback` with a `code`. If a customized email template emits a token hash, direct it to:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Use the appropriate Supabase template type when customizing signup, invite, recovery, or email-change messages.

## 5. Verify

- Request a link from the production sign-in form and complete it in the same browser.
- Confirm `/api/session` reports `provider: "supabase"` and the authenticated email-derived profile name.
- Sign in as two users and verify their drafts, attempts, clears, XP, and shards remain isolated.
- Submit the same passing solution concurrently and verify XP is granted once.
- Save different challenges from two tabs and verify both drafts and both attempt records remain.
- Confirm the browser bundle and deployment environment expose only the URL and publishable key, never `SUPABASE_SERVICE_ROLE_KEY`.

For local fallback verification, leave all three Supabase variables unset and run the normal unit/E2E suite.
