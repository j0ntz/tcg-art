import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getAuthStatus } from "@/lib/auth/status";
import { cn } from "@/lib/utils";
import CredentialsForm from "../components/auth/CredentialsForm";
import GoogleButton from "../components/auth/GoogleButton";
import OrDivider from "../components/auth/OrDivider";
import { cardVariants } from "../components/ui/Card";

export const metadata: Metadata = {
  title: "Log In — TCG-Art",
  description: "Log in to your TCG-Art account.",
};

// NextAuth lands OAuth failures on this page as ?error=<code>; map the codes
// a user can plausibly hit to actionable copy.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email already has a password account. Log in with your email and password instead.",
  AccessDenied: "Access was denied by the sign-in provider.",
  Configuration: "Auth is misconfigured on the server. See docs/auth-setup.md.",
};

interface Props {
  searchParams: Promise<{ error?: string }>;
}

const LoginPage: React.FC<Props> = async ({ searchParams }) => {
  const user = await getSessionUser();
  if (user != null) redirect("/account");

  const status = getAuthStatus();
  const { error } = await searchParams;
  const oauthError = error != null ? (OAUTH_ERROR_MESSAGES[error] ?? "Sign-in failed. Try again.") : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-gutter py-12 font-sans">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Welcome back</h1>
        <p className="text-foreground-subtle">Log in to keep searching card art.</p>
      </header>

      <div className={cn(cardVariants(), "flex flex-col gap-5 p-8")}>
        {oauthError != null ? (
          <p
            className="rounded-field border border-danger-border px-4 py-3 text-sm text-danger"
            role="alert"
          >
            {oauthError}
          </p>
        ) : null}
        <GoogleButton enabled={status.googleEnabled} />
        <OrDivider />
        <CredentialsForm mode="login" enabled={status.credentialsEnabled} />
      </div>

      <p className="text-center text-sm text-foreground-subtle">
        New to TCG-Art?{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Sign up free
        </Link>
      </p>
    </main>
  );
};

export default LoginPage;
