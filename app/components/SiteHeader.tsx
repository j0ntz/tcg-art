import Link from "next/link";
import { buttonVariants } from "./ui/Button";

// Shared top nav across the marketing landing and the search app. Branding on the
// left, a search entry point and a sign-up CTA on the right; "Sign Up Free" links
// to the /signup flow.
const SiteHeader: React.FC = () => {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-content items-center justify-between px-gutter py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand-gradient text-sm font-bold text-primary-foreground">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">TCG-Art</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/search" className={buttonVariants({ variant: "ghost", size: "nav" })}>
            Search
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "primary", size: "sm" })}>
            Sign Up Free
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;
