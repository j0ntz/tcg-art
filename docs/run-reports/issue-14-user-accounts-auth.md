# Agent run report: user accounts (Google auth + username/password on a real database)

**▶ Live preview: https://tcg-5plbmcrgv-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/21**

| field | value |
|---|---|
| Task | #14 · https://github.com/j0ntz/tcg-art/issues/14 |
| PR | https://github.com/j0ntz/tcg-art/pull/21 |
| Preview | https://tcg-5plbmcrgv-jontz.vercel.app |
| Branch | jon/task-14 |
| Verified | pass |
| Date | 2026-07-02 |

## Summary

A real account system: Auth.js (NextAuth v5) with Google OAuth and credentials (email + password, bcrypt cost 12) on Postgres via Drizzle ORM, with committed migrations, JWT sessions, new `/login`, real `/signup`, server-gated `/account`, a session-aware header, and a human runbook (`docs/auth-setup.md`). The credentials flow was proven end to end against a real Postgres (embedded PGlite in dev); the Google flow is implemented and verified to the redirect boundary, with final verification awaiting the human OAuth client from the runbook. The no-env Vercel preview degrades exactly as the issue requires: auth UI renders with both providers disabled and hints.

## Stack chosen

**Auth.js (NextAuth v5) + Drizzle ORM + Postgres** (node-postgres driver in production, embedded PGlite Postgres as the dockerless local dev fallback), over Supabase Auth:

- The agent constraint decided it: no third-party accounts can be created, and only Auth.js + PGlite lets the credentials flow be proven end to end with zero external prerequisites (Supabase needs an account, or Docker for local emulation).
- The v2 pgvector path stays open: production is a plain `DATABASE_URL`, and the runbook recommends Supabase-hosted Postgres as the provider, matching the docs/spec.md v2 plan. Nothing about auth locks the database in.
- No lock-in: the schema is plain Postgres tables owned by Drizzle migrations.

## What changed

- `lib/db/`: Drizzle schema (`user` with `passwordHash`, Auth.js-shaped `account`), committed SQL migration in `drizzle/`, connection layer (`DATABASE_URL` pg Pool in production, self-migrating PGlite under gitignored `.pglite/` in dev).
- `lib/auth/`: NextAuth v5 lazy config, Google provider (env-gated), Credentials provider (bcrypt cost 12), Drizzle adapter, JWT sessions, server actions for signup/login/logout/Google, `getSessionUser()` for server components.
- UI: new `/login`, real `/signup` (replaces the client-only demo), server-gated `/account`, session-aware `SiteHeader` (Account when logged in, Log In + Sign Up Free when logged out).
- Graceful degradation: missing env vars render that provider disabled with a hint to the runbook; `/api/auth/*` answers 503 instead of crashing.
- `docs/auth-setup.md`: human runbook (Google OAuth client with exact redirect URIs for localhost/preview/prod, Supabase provisioning, env var names for Vercel and local).
- Web TS standards held: no `any`, `catch (e: unknown)`, `!= null` guards, `??` defaults, typed props, no unclean effects.

## Test evidence

### Independent preview verification (this report)

- `verify-preview.sh 21 "Log In"` → **pass** against https://tcg-5plbmcrgv-jontz.vercel.app (HTTP 200, mobile 390px overflowBy 0).
- Rendered-HTML assertions on the live preview (no env vars set, so degraded mode is the acceptance state):
  - `/login` and `/signup` → 200, auth UI present, Google + email providers disabled with `docs/auth-setup.md` hints.
  - `/account` → 307 server redirect to `/login` (session gate works logged out).
  - `/api/auth/session` → 503 JSON (`Auth is not configured on this deployment.`) instead of a crash.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since the repo is private):
  - Desktop: [home](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-preview-home-desktop.png), [signup](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-preview-signup-desktop.png), [login](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-preview-login-desktop.png)
  - Mobile (~390px): [home](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-preview-home-mobile.png), [signup](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-preview-signup-mobile.png)

### Builder's end-to-end runs (`npm run auth:flows`, Playwright)

Against `next dev` (PGlite) and a no-env production `next start`, all passing:

1. Sign-up with email + password creates a DB row, logs in, lands on `/account` ([signup](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-signup.png), [account](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-account.png)).
2. Client-side validation errors on bad input ([validation](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-signup-validation.png)).
3. Session persists across reload and navigation; header switches to Account.
4. Logout returns a logged-out header.
5. `/account` without a session server-side-redirects to `/login`.
6. Wrong password shows a server error banner ([error](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-login-error.png)); correct password logs in ([success](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-login-success.png)).
7. Password storage is hashed: the test account's `passwordHash` starts `$2b$12$`, confirmed by querying the database directly; the OAuth `account` table stays empty for credentials users.
8. Degraded mode (production server, zero env vars): providers disabled with hints ([degraded](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-signup-degraded.png)), `/api/auth/session` answers 503.
9. Google flow to the redirect boundary only: "Continue with Google" reaches accounts.google.com ([boundary](https://github.com/j0ntz/tcg-art/blob/jon/task-14/docs/screenshots/issue-14-google-boundary.png)). Token exchange and Google account creation are implemented but need the human OAuth client (runbook step 3).

Not exercised: the production `DATABASE_URL` (node-postgres) path against a hosted Postgres; it shares schema, migrations, and all query code with the verified PGlite path, differing only in the driver.

## Decisions (yolo defaults)

- Auth.js + Drizzle over Supabase Auth (rationale above). Reversible: the schema is plain Postgres; Supabase-hosted Postgres is the recommended `DATABASE_URL` provider.
- JWT sessions instead of database sessions (required by the credentials provider; keeps Google consistent and needs no session table). Reversible later for OAuth-only flows.
- Account linking off (Auth.js safe default): a Google sign-in on an email that already has a password account is refused with a hint to use the password.

## Notes & follow-ups

- The preview's resolved deployment SHA (`198f928`) is the branch HEAD; verification passed on the first round, no fixes were needed.
- Full Google verification is blocked on the human runbook steps in `docs/auth-setup.md` (OAuth client + env vars in Vercel); credentials login on previews additionally needs `AUTH_SECRET` + `DATABASE_URL` set for the Preview environment.
- The session check in the shared header makes routes dynamic on configured deployments; on the current no-env preview `getSessionUser()` short-circuits, so nothing regressed.
- Local reset: delete `.pglite/` and restart dev.
