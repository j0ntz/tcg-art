import Link from "next/link";

// Shared top nav across the marketing landing and the search app. Branding on the
// left, a search entry point and a sign-up CTA on the right; "Sign Up Free" links
// to the /signup flow.
const SiteHeader: React.FC = () => {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900">TCG-Art</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/search"
            className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Search
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Sign Up Free
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;
