import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { buttonVariants } from "./ui/Button";

// Shared top nav across the marketing landing and the search app. Branding on
// the left; on the right the auth-aware actions: logged out gets Log In plus
// the sign-up CTA, logged in gets an Account link. The session check is
// server-side (it reads the session cookie), which makes every page dynamic;
// acceptable at this stage since the search page already renders per-request.
const SiteHeader: React.FC = async () => {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-content items-center justify-between px-gutter py-3">
        <Link href="/" className="flex items-baseline gap-0.5">
          <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
            TCG
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-foreground-subtle">
            ·Art
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/search" className={buttonVariants({ variant: "ghost", size: "nav" })}>
            Search
          </Link>
          {user != null ? (
            <>
              <Link href="/binder" className={buttonVariants({ variant: "ghost", size: "nav" })}>
                Binder
              </Link>
              <Link href="/account" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Account
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "nav" })}>
                Log In
              </Link>
              <Link href="/signup" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Sign Up Free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;
