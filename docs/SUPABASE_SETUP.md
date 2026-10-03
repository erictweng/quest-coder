# Supabase Setup for Quest Coder

Production uses Supabase Auth for identity and Supabase Postgres for progress. When all Supabase variables are absent, Quest Coder keeps the credential-free local SQLite/display-name flow used by tests and local development. Partial Supabase configuration is rejected.

## 1. Create and configure the project

1. Create a Supabase project.
2. In **Authentication → URL Configuration**, set the Site URL to the deployed Quest Coder URL (production: `https://quest-coder.vercel.app`; do not use per-deployment `*-<hash>.vercel.app` URLs).
3. Add redirect URLs for:
   - `https://<production-host>/auth/callback`
   - `http://localhost:3000/auth/callback` for local Supabase testing
4. Enable email passwordless sign-in. Quest Coder calls `signInWithOtp` and supports both PKCE `code` callbacks and `token_hash` confirmation links.

## 2. Apply the database migration, then expose the schema

Apply `supabase/migrations/202610020001_quest_coder_auth_progress.sql` through the Supabase CLI or SQL editor **before** exposing the schema: the `quest_coder` schema does not exist until the migration creates it, so it will not appear in the API settings dropdown yet. Then, in **API Settings → Exposed schemas**, add `quest_coder`. The application invokes only service-role RPCs in this schema; the browser does not receive the service-role key. Exposed tables can stay empty.

CI applies this migration twice to real Postgres and exercises the functions, reward idempotency, client-write limits, and RLS (`supabase/tests/`). The migration is idempotent and creates:

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

## 4. Google sign-in (optional, recommended)

The **Continue with Google** button appears only in Supabase mode. It calls `/auth/google`, which starts a PKCE OAuth flow; Google returns through Supabase to `/auth/callback`, which already exchanges the code for a session. No email is sent.

1. In Google Cloud Console → **APIs & Services → OAuth consent screen**, configure the app (External, app name, support email; scopes `openid`, `email`, `profile` only).
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized JavaScript origins: `https://quest-coder.vercel.app`
   - Authorized redirect URI: the **Callback URL** shown in Supabase → Authentication → Sign In / Providers → Google (`https://<project-ref>.supabase.co/auth/v1/callback`). Not the app's `/auth/callback`.
3. In Supabase → **Authentication → Sign In / Providers → Google**, enable it and paste the Client ID and Client Secret. The secret lives only in Supabase; Quest Coder needs no new environment variables.
4. Keep `https://quest-coder.vercel.app/auth/callback` in Supabase's redirect allow-list (already required for email links).

Google supplies `full_name`, which becomes the display name. Supabase links a Google identity to an existing account with the same verified email, so an earlier magic-link save carries over.

Vercel preview deployments still redirect back to the production `NEXT_PUBLIC_SITE_URL`, so test OAuth sign-in on production (or a preview with its own `NEXT_PUBLIC_SITE_URL` and an allow-listed callback).

## 5. Email template options

The normal PKCE magic-link flow redirects to `/auth/callback` with a `code`. If a customized email template emits a token hash, direct it to:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Use the appropriate Supabase template type when customizing signup, invite, recovery, or email-change messages.

## 6. Verify

- Request a link from the production sign-in form and complete it in the same browser.
- Confirm `/api/session` reports `provider: "supabase"` and the authenticated email-derived profile name.
- Sign in as two users and verify their drafts, attempts, clears, XP, and shards remain isolated.
- Submit the same passing solution concurrently and verify XP is granted once.
- Save different challenges from two tabs and verify both drafts and both attempt records remain; confirm a stale tab cannot erase or replace the newer `lastChallengeId` resume pointer.
- Confirm the browser bundle and deployment environment expose only the URL and publishable key, never `SUPABASE_SERVICE_ROLE_KEY`.

For local fallback verification, leave all three Supabase variables unset and run the normal unit/E2E suite.
