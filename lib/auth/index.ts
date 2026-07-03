import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { getDb } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { getAuthSecret, getAuthStatus } from "./status";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

// Config is built lazily (per request) because the database handle is async:
// the PGlite dev fallback applies migrations on first open. It also lets a
// half-configured deployment (e.g. Google keys but no database) expose only
// the providers that can actually work.
const buildConfig = async (): Promise<NextAuthConfig> => {
  const status = getAuthStatus();
  const db = status.dbConfigured ? await getDb() : null;

  const providers: NextAuthConfig["providers"] = [];
  if (status.googleEnabled) {
    // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the environment.
    providers.push(Google);
  }
  if (status.credentialsEnabled && db != null) {
    providers.push(
      Credentials({
        credentials: { email: {}, password: {} },
        authorize: async credentials => {
          const email =
            typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
          const password = typeof credentials.password === "string" ? credentials.password : "";
          if (email === "" || password === "") return null;
          const user = await db.query.users.findFirst({ where: eq(users.email, email) });
          if (user == null || user.passwordHash == null) return null;
          const passwordMatches = await compare(password, user.passwordHash);
          if (!passwordMatches) return null;
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        },
      }),
    );
  }

  return {
    secret: getAuthSecret(),
    adapter:
      db != null ? DrizzleAdapter(db, { usersTable: users, accountsTable: accounts }) : undefined,
    // JWT sessions: required by the credentials provider (which never creates
    // database sessions) and they keep Google sessions consistent with it.
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers,
    callbacks: {
      // token.sub is the user id from sign-in; surface it on the session so
      // future features can key rows off session.user.id.
      session: ({ session, token }) => {
        if (token.sub != null) session.user.id = token.sub;
        return session;
      },
    },
  };
};

export const { handlers, auth, signIn, signOut } = NextAuth(buildConfig);

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

// Session accessor for server components. Short-circuits when auth is not
// configured (production without AUTH_SECRET) so every page still renders on
// bare preview deployments instead of throwing MissingSecret.
export const getSessionUser = async (): Promise<SessionUser | null> => {
  if (!getAuthStatus().authEnabled) return null;
  const session = await auth();
  const user = session?.user;
  if (user == null) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
  };
};
