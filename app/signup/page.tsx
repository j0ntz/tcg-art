import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Sign Up — TCG-Art",
  description: "Create a free TCG-Art account to search Pokémon cards by their art.",
};

// Branding lives in the shared SiteHeader (app/layout.tsx), so the page itself
// drops the duplicate wordmark and leans on the landing hero's violet wash and
// badge pill to stay on-theme.
const SignupPage: React.FC = () => {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-violet-50 via-white to-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-16 pb-24">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
            Free forever, no credit card
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-zinc-900">
            Create your free account
          </h1>
          <p className="text-zinc-600">Unlimited art search starts here.</p>
        </header>

        <SignupForm />
      </div>
    </main>
  );
};

export default SignupPage;
