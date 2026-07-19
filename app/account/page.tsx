import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { logOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import Button from "../components/ui/Button";
import { cardVariants } from "../components/ui/Card";

export const metadata: Metadata = {
  title: "Account — TCG-Art",
  description: "Your TCG-Art account.",
};

// Server-side session gate: no session, no page. This is the pattern future
// signed-in features (saves/decks) should copy.
const AccountPage: React.FC = async () => {
  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const displayName = user.name ?? user.email ?? "Collector";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-gutter py-12 font-sans">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Your account</h1>
        <p className="text-foreground-subtle">You are logged in.</p>
      </header>

      <div
        className={cn(cardVariants(), "flex flex-col items-center gap-4 p-8 text-center")}
        data-testid="account-card"
      >
        {user.image != null ? (
          <Image
            src={user.image}
            alt=""
            width={64}
            height={64}
            className="rounded-pill"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-surface-inverse font-display text-2xl font-semibold text-primary-foreground">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="flex flex-col gap-1">
          <p className="font-semibold text-foreground" data-testid="account-name">
            {displayName}
          </p>
          {user.name != null && user.email != null ? (
            <p className="text-sm text-foreground-subtle">{user.email}</p>
          ) : null}
        </div>

        <form action={logOut}>
          <Button type="submit" variant="secondary" size="md">
            Log out
          </Button>
        </form>
      </div>
    </main>
  );
};

export default AccountPage;
