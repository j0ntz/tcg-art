"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signIn, signOut } from "./index";
import { getAuthStatus } from "./status";
import { validateEmail, validatePassword } from "./validation";

export interface AuthActionResult {
  error?: string;
}

// bcrypt work factor; the bcryptjs default (10) is on the low side for 2026.
const BCRYPT_ROUNDS = 12;

const CREDENTIALS_UNAVAILABLE =
  "Email sign-in is not configured on this deployment yet. See docs/auth-setup.md.";

// On success these actions never return: signIn/signOut end in a redirect,
// which Next.js surfaces by throwing. Only AuthError is converted into a
// user-facing message; redirects must be re-thrown.
const signInWithCredentials = async (email: string, password: string): Promise<AuthActionResult> => {
  try {
    await signIn("credentials", { email, password, redirectTo: "/account" });
    return {};
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return {
        error:
          e.type === "CredentialsSignin"
            ? "Incorrect email or password."
            : "Sign-in failed. Try again.",
      };
    }
    throw e;
  }
};

export const logInWithPassword = async (input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> => {
  if (!getAuthStatus().credentialsEnabled) return { error: CREDENTIALS_UNAVAILABLE };
  return signInWithCredentials(input.email.trim().toLowerCase(), input.password);
};

export const signUpWithPassword = async (input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> => {
  if (!getAuthStatus().credentialsEnabled) return { error: CREDENTIALS_UNAVAILABLE };

  const email = input.email.trim().toLowerCase();
  const emailError = validateEmail(email);
  if (emailError != null) return { error: emailError };
  const passwordError = validatePassword(input.password);
  if (passwordError != null) return { error: passwordError };

  const db = await getDb();
  if (db == null) return { error: CREDENTIALS_UNAVAILABLE };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing != null) {
    return { error: "An account with this email already exists. Log in instead." };
  }

  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
  try {
    await db.insert(users).values({ email, passwordHash });
  } catch (e: unknown) {
    // Most likely the unique-email constraint under a concurrent double
    // submit; surface it the same way as the pre-check.
    console.error("signUpWithPassword insert failed", e);
    return { error: "Could not create the account. Try again." };
  }

  return signInWithCredentials(email, input.password);
};

export const logInWithGoogle = async (): Promise<void> => {
  await signIn("google", { redirectTo: "/account" });
};

export const logOut = async (): Promise<void> => {
  await signOut({ redirectTo: "/" });
};
