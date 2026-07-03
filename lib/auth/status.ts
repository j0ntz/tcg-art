import { isDbConfigured } from "@/lib/db";

// Runtime feature detection for auth. Everything is env-var driven so a
// deployment with no secrets still builds and renders: the auth UI shows up
// with the unavailable providers disabled and a hint pointing at the runbook
// (docs/auth-setup.md). Server-only; pass the resulting booleans to client
// components as props.

// Used only under `next dev` so the credentials flow works with zero setup.
// Production NEVER falls back: without AUTH_SECRET, sessions are simply off
// (a forged JWT would otherwise be trivial).
const DEV_FALLBACK_SECRET = "tcg-art-dev-only-secret-do-not-use-in-prod";

export const getAuthSecret = (): string | undefined => {
  const secret = process.env.AUTH_SECRET;
  if (secret != null && secret !== "") return secret;
  return process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK_SECRET;
};

export interface AuthStatus {
  // A session secret exists, so NextAuth may run at all.
  authEnabled: boolean;
  dbConfigured: boolean;
  // Email + password sign-up/login (needs secret + database).
  credentialsEnabled: boolean;
  // Google OAuth (needs secret + database + Google client credentials).
  googleEnabled: boolean;
}

export const getAuthStatus = (): AuthStatus => {
  const authEnabled = getAuthSecret() != null;
  const dbConfigured = isDbConfigured();
  const googleKeysPresent =
    process.env.AUTH_GOOGLE_ID != null &&
    process.env.AUTH_GOOGLE_ID !== "" &&
    process.env.AUTH_GOOGLE_SECRET != null &&
    process.env.AUTH_GOOGLE_SECRET !== "";
  return {
    authEnabled,
    dbConfigured,
    credentialsEnabled: authEnabled && dbConfigured,
    googleEnabled: authEnabled && dbConfigured && googleKeysPresent,
  };
};
