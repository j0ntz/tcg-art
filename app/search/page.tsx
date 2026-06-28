import Image from "next/image";
import type { Metadata } from "next";
import { searchCards, type Card } from "@/lib/pokemon";

export const metadata: Metadata = {
  title: "Search — TCG-Art",
  description: "Search 20,000+ Pokémon TCG cards by name.",
};

interface SearchProps {
  searchParams: Promise<{ q?: string }>;
}

const SearchPage = async ({ searchParams }: SearchProps) => {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let cards: Card[] = [];
  let error: string | null = null;
  if (query.length > 0) {
    try {
      cards = await searchCards(query);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Search failed";
    }
  }

  const hasQuery = query.length > 0;

  return (
    <main className="flex flex-1 flex-col">
      {/* Gradient search band mirrors the landing hero so the search app reads as
          the same product: violet wash, badge pill, and the shared search input
          and gradient CTA. */}
      <section className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-b from-violet-50 via-white to-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:py-16">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
              Smart Trading Card Search
            </span>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-4xl">
              Find by Card
            </h1>
            <p className="max-w-xl text-lg text-zinc-600">
              Search across 20,000+ Pokémon TCG cards by name.
            </p>
          </div>

          <form action="/search" className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Try: charizard, surfing pikachu, mewtwo…"
              autoFocus
              aria-label="Search Pokémon cards"
              className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-zinc-900 shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        {error != null ? (
          <p className="text-red-600">Something went wrong: {error}</p>
        ) : null}

        {!hasQuery ? (
          <p className="text-zinc-500">Type a card name above to start searching.</p>
        ) : null}

        {hasQuery && error == null && cards.length === 0 ? (
          <p className="text-zinc-500">No cards found for &ldquo;{query}&rdquo;.</p>
        ) : null}

        {cards.length > 0 ? (
          <section>
            <p className="mb-4 text-sm text-zinc-500">{cards.length} cards</p>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {cards.map(card => (
                <li key={card.id}>
                  <a
                    href={card.images.large}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <Image
                      src={card.images.small}
                      alt={card.name}
                      width={245}
                      height={342}
                      className="h-auto w-full rounded-xl shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-[1.03]"
                    />
                    <div className="mt-2">
                      <p className="truncate font-medium text-zinc-900">{card.name}</p>
                      <p className="truncate text-sm text-zinc-500">
                        {card.set.name} · {card.number}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default SearchPage;
