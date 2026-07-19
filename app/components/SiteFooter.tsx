import Link from "next/link";

// Shared footer. The IP disclaimer is a product requirement (see docs/spec.md §12):
// the site operates in the same tolerated gray zone as other fan databases.
const SiteFooter: React.FC = () => {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-gutter py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-0.5">
            <span className="font-display font-extrabold tracking-tight text-foreground">TCG</span>
            <span className="font-display font-extralight text-foreground-subtle">·Art</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground-subtle">
            <Link href="/search" className="transition-colors hover:text-foreground">
              Search
            </Link>
            <span className="cursor-default">Privacy Policy</span>
            <span className="cursor-default">Terms</span>
            <span className="cursor-default">Cookie Settings</span>
            <span className="cursor-default">Contact</span>
          </nav>
        </div>

        <p className="max-w-3xl text-xs leading-relaxed text-foreground-faint">
          Not affiliated with The Pokémon Company, Nintendo, Creatures, or Game Freak. All card
          images and names are property of their respective owners. Card data and images are
          provided by the Pokémon TCG API.
        </p>
      </div>
    </footer>
  );
};

export default SiteFooter;
