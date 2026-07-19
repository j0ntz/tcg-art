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
  title: "Sign Up — TCG-Art",
  description: "Create a free TCG-Art account to search Pokémon cards by their art.",
};

// Branding lives in the shared SiteHeader (app/layout.tsx), so the page omits a
// duplicate wordmark and leans on the global header plus the design tokens to
// stay on-theme.
const SignupPage: React.FC = async () => {
  const user = await getSessionUser();
  if (user != null) redirect("/account");

  const status = getAuthStatus();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-gutter py-12 font-sans">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Create your free account</h1>
        <p className="text-foreground-subtle">Unlimited art search starts here.</p>
      </header>

      <div className={cn(cardVariants(), "flex flex-col gap-5 p-8")}>
        <GoogleButton enabled={status.googleEnabled} />
        <OrDivider />
        <CredentialsForm mode="signup" enabled={status.credentialsEnabled} />
      </div>

      <p className="text-center text-sm text-foreground-subtle">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </main>
  );
};

export default SignupPage;
