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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Find by Card</h1>
        <p className="text-zinc-500">Search 20,000+ Pokémon cards by name.</p>
      </header>

      <form action="/search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Try: charizard, surfing pikachu, mewtwo…"
          autoFocus
          className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-zinc-900 outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Search
        </button>
      </form>

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
                    className="h-auto w-full rounded-lg shadow-sm transition-transform group-hover:scale-[1.03]"
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
    </main>
  );
};

export default SearchPage;
