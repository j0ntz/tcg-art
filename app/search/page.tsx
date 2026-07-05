import Image from "next/image";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { getOwnedQuantities } from "@/lib/collection";
import { addCardToCollection } from "@/lib/collection/actions";
import { searchCards, type Card } from "@/lib/pokemon";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";

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

  // Logged-in searchers get the add-to-binder path on every result, with
  // already-collected cards marked. Logged-out search is unchanged.
  const user = await getSessionUser();
  const ownedQuantities =
    user != null && cards.length > 0 ? await getOwnedQuantities(user.id) : new Map<string, number>();

  return (
    <main className="flex flex-1 flex-col">
      {/* Search band mirrors the landing hero so the search app reads as the same
          product: the brand wash, the badge pill, and the shared pill input with
          the gradient CTA, all built from the shared design tokens. */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-gutter py-12 sm:py-16">
          <div className="flex flex-col gap-3">
            <Badge variant="soft">Smart Trading Card Search</Badge>
            <h1 className="text-heading font-bold leading-tight tracking-tight text-foreground sm:text-title">
              Find by Card
            </h1>
            <p className="max-w-xl text-lead text-foreground-muted">
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
              className="flex-1 rounded-pill border border-border-strong bg-surface px-5 py-3 text-foreground shadow-card outline-none focus:border-ring focus:ring-2 focus:ring-primary-border"
            />
            <Button type="submit" variant="gradient" size="lg" className="shadow-card">
              Search
            </Button>
          </form>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-gutter py-10">
        {error != null ? (
          <p className="text-danger">Something went wrong: {error}</p>
        ) : null}

        {!hasQuery ? (
          <p className="text-foreground-subtle">Type a card name above to start searching.</p>
        ) : null}

        {hasQuery && error == null && cards.length === 0 ? (
          <p className="text-foreground-subtle">No cards found for &ldquo;{query}&rdquo;.</p>
        ) : null}

        {cards.length > 0 ? (
          <section>
            <p className="mb-4 text-sm text-foreground-subtle">{cards.length} cards</p>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {cards.map(card => {
                const owned = ownedQuantities.get(card.id);
                return (
                  <li key={card.id} className="flex flex-col">
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
                        className="h-auto w-full rounded-field shadow-card transition-transform group-hover:scale-[1.03]"
                      />
                      <div className="mt-2">
                        <p className="truncate font-medium text-foreground">{card.name}</p>
                        <p className="truncate text-sm text-foreground-subtle">
                          {card.set.name} · {card.number}
                        </p>
                      </div>
                    </a>
                    {user != null ? (
                      <div className="mt-2 flex items-center gap-2">
                        <form action={addCardToCollection} className="flex-1">
                          <input type="hidden" name="cardId" value={card.id} />
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            className="w-full whitespace-nowrap px-2"
                            data-testid={`add-${card.id}`}
                          >
                            {owned != null ? "+ Add another" : "+ Add to binder"}
                          </Button>
                        </form>
                        {owned != null ? (
                          <Badge variant="solid" size="sm" data-testid={`owned-${card.id}`}>
                            ×{owned}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default SearchPage;
