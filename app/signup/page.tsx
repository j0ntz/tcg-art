import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Sign Up — TCG-Art",
  description: "Create a free TCG-Art account to search Pokémon cards by their art.",
};

// Branding lives in the shared SiteHeader (app/layout.tsx), so the page omits a
// duplicate wordmark and leans on the global header plus the design tokens to
// stay on-theme.
const SignupPage: React.FC = () => {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-gutter py-12 font-sans">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-xl font-semibold text-foreground">Create your free account</h1>
        <p className="text-foreground-subtle">Unlimited art search starts here.</p>
      </header>

      <SignupForm />
    </main>
  );
};

export default SignupPage;
