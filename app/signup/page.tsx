import type { Metadata } from "next";
import Link from "next/link";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Sign Up — TCG-Art",
  description: "Create a free TCG-Art account to search Pokémon cards by their art.",
};

const SignupPage: React.FC = () => {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12 font-sans">
      <header className="flex flex-col gap-2 text-center">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-zinc-900">
          TCG-Art
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900">Create your free account</h1>
        <p className="text-zinc-500">Unlimited art search starts here.</p>
      </header>

      <SignupForm />
    </main>
  );
};

export default SignupPage;
