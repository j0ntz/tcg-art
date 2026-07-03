# Auth setup runbook

Everything in this document is a HUMAN step: creating third-party accounts, OAuth clients, and setting secrets. The app is built so that none of these steps block development or preview deployments; until they are done, the auth UI renders with the unavailable providers disabled and a hint pointing here.

## Stack summary (what you are configuring)

- **Auth.js (NextAuth v5)** with two providers: Google OAuth and credentials (email + password, bcrypt-hashed).
- **Postgres via Drizzle ORM.** Production uses `DATABASE_URL` (any Postgres: Supabase recommended, see below). Local dev needs nothing: an embedded PGlite Postgres lives in `.pglite/` and migrates itself.
- **JWT sessions** (cookie-based), so no session table and no extra infra.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `AUTH_SECRET` | Vercel (Production + Preview) and `.env.local` | Signs session JWTs. Auth is disabled without it in production. |
| `DATABASE_URL` | Vercel (Production + Preview) and optionally `.env.local` | Postgres connection string. Without it, dev falls back to PGlite; production disables sign-in. |
| `AUTH_GOOGLE_ID` | Vercel and `.env.local` | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | Vercel and `.env.local` | Google OAuth client secret. |
| `AUTH_TRUST_HOST=true` | Only if self-hosting outside Vercel | Auth.js trusts the proxy host header. Not needed on Vercel or in dev. |

Degradation matrix (what works with what):

| Configured | Result |
|---|---|
| Nothing | Site builds and renders; login/signup pages show both providers disabled. |
| `AUTH_SECRET` only | Same as nothing in production (a database is still required). |
| `AUTH_SECRET` + `DATABASE_URL` | Email + password sign-up/login works; Google button disabled. |
| All four | Everything works. |

## Step 1: generate AUTH_SECRET

```sh
openssl rand -base64 32
```

Set the output as `AUTH_SECRET` in Vercel (Settings > Environment Variables, check Production and Preview) and in your local `.env.local`.

## Step 2: provision the database

Recommended: **Supabase** (managed Postgres). It keeps the v2 semantic-search path open because pgvector is available as a one-click extension, and `docs/spec.md` already pencils Supabase in for v2. Any other Postgres (Neon, Vercel Postgres, RDS) works identically; only `DATABASE_URL` changes.

1. Create a project at https://supabase.com/dashboard (free tier is fine).
2. In the project: **Connect** (top bar) > **Connection string** > choose **Transaction pooler** (port 6543) for the serverless app. Copy the URI and substitute the database password.
3. Set it as `DATABASE_URL` in Vercel (Production + Preview) and, if you want to develop against it, in `.env.local`.
4. Apply the committed migrations from a checkout of this repo:

   ```sh
   DATABASE_URL="postgres://..." npx drizzle-kit migrate
   ```

   Migrations live in `drizzle/` and are generated from `lib/db/schema.ts` with `npx drizzle-kit generate`. Note: for `drizzle-kit migrate`, use the **direct connection** string (port 5432) rather than the transaction pooler if the pooler rejects prepared statements.

To inspect data later: `DATABASE_URL="postgres://..." npx drizzle-kit studio`.

## Step 3: create the Google OAuth client

1. Go to https://console.cloud.google.com/ and create (or pick) a project, e.g. `tcg-art`.
2. **APIs & Services > OAuth consent screen** (Google Auth Platform > Branding on newer consoles):
   - User type: **External**. App name `TCG-Art`, add your support email. Default (non-sensitive) scopes are enough; the app only requests `openid email profile`.
   - Add yourself as a test user while the app is in Testing mode. Publish the app when real users need to sign in.
3. **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - Application type: **Web application**, name `tcg-art-web`.
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://<your-prod-domain>` (e.g. `https://tcg-art.vercel.app`)
   - Authorized redirect URIs (the path is fixed by Auth.js):
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<your-prod-domain>/api/auth/callback/google`
4. Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (Vercel + `.env.local`).

Vercel preview deployments: Google does not accept wildcard redirect URIs, so per-commit preview URLs cannot complete the Google flow. If you want Google login on previews, also add the stable branch alias, e.g. `https://tcg-art-git-main-<team>.vercel.app/api/auth/callback/google`. Email + password login works on any preview that has `AUTH_SECRET` and `DATABASE_URL` set.

## Step 4: redeploy and verify

1. Redeploy (env var changes need a new deployment).
2. `/signup`: create an account with email + password, you should land on `/account` logged in.
3. Log out, then `/login` with the same credentials.
4. `/login` > Continue with Google: complete the consent screen, land on `/account`.
5. Optional: check the `user` and `account` tables in Supabase Studio or `npx drizzle-kit studio`; the Google user has a row in both, the credentials user has a `passwordHash` and no `account` row.

## Local development notes

- No setup: `npm run dev` uses the embedded PGlite database in `.pglite/` (gitignored) and a dev-only session secret. Delete `.pglite/` to reset local accounts.
- To test the real Google flow locally, put all four env vars in `.env.local`; the `http://localhost:3000` redirect URI from step 3 covers it.
- One Google account cannot log in twice via different providers on the same email: if the email already has a password account, Google sign-in is refused with a hint to use the password (account linking is intentionally off, the Auth.js safe default).
