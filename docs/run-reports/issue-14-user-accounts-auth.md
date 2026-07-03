# Run report: issue #14, user accounts (Google auth + username/password on a real database)

## Stack chosen

**Auth.js (NextAuth v5) + Drizzle ORM + Postgres** (node-postgres driver in production, embedded PGlite Postgres as the dockerless local dev fallback).

Evaluation against the two candidates from the issue:

| | Auth.js + Postgres (chosen) | Supabase (Postgres + Auth) |
|---|---|---|
| Third-party account needed to develop | No: PGlite runs Postgres in-process for dev, `DATABASE_URL` for prod | Yes: even `supabase start` local dev needs Docker; hosted needs an account (constraint: agents cannot create one) |
| pgvector / v2 semantic-search path | Open: plain `DATABASE_URL`; Supabase-hosted Postgres is the recommended provider in the runbook, so pgvector stays one extension-toggle away | Open (native) |
| Credentials (username/password) | First-class via the Credentials provider + bcrypt | Supported |
| Lock-in | None: schema is plain Postgres tables owned by Drizzle migrations | Auth schema owned by Supabase |

Deciding factor: the verification constraint. Only Auth.js + PGlite let the credentials flow be proven end to end against a real Postgres with zero external accounts, and pointing `DATABASE_URL` at a Supabase project later (recommended in `docs/auth-setup.md`) preserves the spec.md v2 pgvector plan.

## What was built

- `lib/db/`: Drizzle schema (`user` with `passwordHash`, Auth.js-shaped `account`), committed SQL migration in `drizzle/`, and a connection layer that uses `DATABASE_URL` (pg Pool) in production and self-migrating PGlite (`.pglite/`, gitignored) in dev.
- `lib/auth/`: NextAuth v5 with lazy config (async DB handle), Google provider (env-gated), Credentials provider (bcrypt, cost 12), JWT sessions, Drizzle adapter, plus server actions for signup/login/logout/Google.
- UI: `/login` (new), `/signup` (rewired from the client-only demo to the real backend), `/account` (server-side session gate), session-aware `SiteHeader`. Providers that lack env vars render disabled with a hint to `docs/auth-setup.md`.
- `app/api/auth/[...nextauth]` answers 503 instead of crashing when `AUTH_SECRET` is absent in production.
- `docs/auth-setup.md`: human runbook (Google OAuth client with exact redirect URIs, Supabase provisioning, env var names for Vercel and local).

## What was verified end to end (and what was not)

Verification harness: `npm run auth:flows` (`orchestration/playwright/auth-flows.mjs`) against `next dev` (PGlite) and against a no-env production `next start`.

Exercised end to end (all passing):

1. Sign-up with email + password: creates a DB row, logs in, lands on `/account` (issue-14-signup.png, issue-14-account.png).
2. Client-side validation errors on bad input (issue-14-signup-validation.png).
3. Session persistence across reload and navigation; header switches to Account.
4. Logout returns to a logged-out header.
5. `/account` without a session server-side-redirects to `/login`.
6. Login with wrong password shows a server error banner (issue-14-login-error.png); correct password logs in (issue-14-login-success.png).
7. Password storage is hashed: the `user` row for the test account has `passwordHash` starting `$2b$12$` and the OAuth `account` table is empty, queried directly from the PGlite database after the run.
8. Degraded mode (production server, zero auth env vars): `/signup` renders with both providers disabled and runbook hints (issue-14-signup-degraded.png), `/api/auth/session` answers 503, landing page renders 200.

Verified to the redirect boundary only (as the issue allows):

9. Google flow: with dummy `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, clicking "Continue with Google" redirects the browser to `accounts.google.com` (issue-14-google-boundary.png). Completing the consent screen requires the human runbook steps (real OAuth client), so token exchange, adapter user/account creation for Google, and the `OAuthAccountNotLinked` path are implemented but not exercised.

Not exercised: production `DATABASE_URL` (node-postgres) path against a hosted Postgres; it shares the schema, migrations, and all query code with the verified PGlite path, differing only in the driver.

## Notes for the verifier

- On a preview deployment without env vars, expect the degraded state: auth UI present, both providers disabled with hints. This is the intended acceptance behavior.
- The session check in the shared header makes routes dynamic on configured deployments. The landing page keeps its daily fetch cache for card data, so per-request cost is the session decode.
- Local reset: delete `.pglite/` and restart dev.
