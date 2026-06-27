import Link from "next/link";

// Shared footer. The IP disclaimer is a product requirement (see docs/spec.md §12):
// the site operates in the same tolerated gray zone as other fan databases.
const SiteFooter: React.FC = () => {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white">
              T
            </span>
            <span className="font-semibold tracking-tight text-zinc-900">TCG-Art</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
            <Link href="/search" className="transition-colors hover:text-zinc-900">
              Search
            </Link>
            <span className="cursor-default">Privacy Policy</span>
            <span className="cursor-default">Terms</span>
            <span className="cursor-default">Cookie Settings</span>
            <span className="cursor-default">Contact</span>
          </nav>
        </div>

        <p className="max-w-3xl text-xs leading-relaxed text-zinc-400">
          Not affiliated with The Pokémon Company, Nintendo, Creatures, or Game Freak. All card
          images and names are property of their respective owners. Card data and images are
          provided by the Pokémon TCG API.
        </p>
      </div>
    </footer>
  );
};

export default SiteFooter;
