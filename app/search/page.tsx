import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { getOwnedQuantities } from "@/lib/collection";
import { addCardToCollection } from "@/lib/collection/actions";
import { searchArt, type ArtSearchResult } from "@/lib/art-search";
import { searchCards, type Card } from "@/lib/pokemon";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";

export const metadata: Metadata = {
  title: "Search — TCG-Art",
  description: "Describe the art you remember and find the card, or search by exact name.",
};

interface SearchProps {
  searchParams: Promise<{ q?: string; mode?: string }>;
}

// A row the results grid can render regardless of which engine produced it.
interface GridCard {
  cardId: string;
  name: string;
  setName: string;
  number: string;
  imageSmall: string;
  imageLarge: string;
  matched: string[];
}

const fromArtResult = ({ entry, matched }: ArtSearchResult): GridCard => ({
  cardId: entry.cardId,
  name: entry.name,
  setName: entry.setName,
  number: entry.number,
  imageSmall: entry.imageSmall,
  imageLarge: entry.imageLarge,
  matched,
});

const fromCard = (card: Card): GridCard => ({
  cardId: card.id,
  name: card.name,
  setName: card.set.name,
  number: card.number,
  imageSmall: card.images.small,
  imageLarge: card.images.large,
  matched: [],
});

const SearchPage = async ({ searchParams }: SearchProps) => {
  const { q, mode } = await searchParams;
  const query = (q ?? "").trim();
  // Semantic art search is the primary mode; exact-name search stays available
  // as the fallback/filter mode via ?mode=name.
  const nameMode = mode === "name";

  let cards: GridCard[] = [];
  let engineNote: string | null = null;
  let error: string | null = null;
  if (query.length > 0) {
    try {
      if (nameMode) {
        cards = (await searchCards(query)).map(fromCard);
      } else {
        const response = await searchArt(query);
        cards = response.results.map(fromArtResult);
        engineNote =
          response.mode === "haiku"
            ? `semantic match over ${response.indexSize.toLocaleString()} indexed cards`
            : `lexical match over ${response.indexSize.toLocaleString()} indexed cards`;
      }
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

  const modeToggle = (
    <div className="flex items-center gap-2 text-sm" data-testid="search-mode-toggle">
      <Link
        href={query.length > 0 ? `/search?q=${encodeURIComponent(query)}` : "/search"}
        aria-current={!nameMode ? "page" : undefined}
        className={
          !nameMode
            ? "rounded-pill bg-surface-inverse px-4 py-1.5 font-semibold text-primary-foreground"
            : "rounded-pill border border-border-strong px-4 py-1.5 font-medium text-foreground-muted hover:text-foreground"
        }
      >
        Describe the art
      </Link>
      <Link
        href={query.length > 0 ? `/search?mode=name&q=${encodeURIComponent(query)}` : "/search?mode=name"}
        aria-current={nameMode ? "page" : undefined}
        className={
          nameMode
            ? "rounded-pill bg-surface-inverse px-4 py-1.5 font-semibold text-primary-foreground"
            : "rounded-pill border border-border-strong px-4 py-1.5 font-medium text-foreground-muted hover:text-foreground"
        }
      >
        Exact name
      </Link>
    </div>
  );

  return (
    <main className="flex flex-1 flex-col">
      {/* Search band mirrors the landing hero so the search app reads as the same
          product: the brand wash, the badge pill, and the shared pill input with
          the gradient CTA, all built from the shared design tokens. */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-gutter py-12 sm:py-16">
          <div className="flex flex-col gap-3">
            <Badge variant="soft">Semantic Art Search</Badge>
            <h1 className="text-heading font-bold leading-tight tracking-tight text-foreground sm:text-title">
              {nameMode ? "Find by Card Name" : "Describe the Art"}
            </h1>
            <p className="max-w-xl text-lead text-foreground-muted">
              {nameMode
                ? "Search across 20,000+ Pokémon TCG cards by exact name."
                : "Say what is IN the artwork — a scene, a mood, a color — and find the card."}
            </p>
          </div>

          <form action="/search" className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            {nameMode ? <input type="hidden" name="mode" value="name" /> : null}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={
                nameMode
                  ? "Try: charizard, surfing pikachu, mewtwo…"
                  : "Try: sad ghost in the rain, pikachu riding a wave…"
              }
              autoFocus
              aria-label={nameMode ? "Search Pokémon cards by name" : "Describe the card art"}
              className="flex-1 rounded-pill border border-border-strong bg-surface px-5 py-3 text-foreground shadow-card outline-none focus:border-ring focus:ring-2 focus:ring-primary-border"
            />
            <Button type="submit" variant="gradient" size="lg" className="shadow-card">
              Search
            </Button>
          </form>

          {modeToggle}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-gutter py-10">
        {error != null ? (
          <p className="text-danger">Something went wrong: {error}</p>
        ) : null}

        {!hasQuery ? (
          <p className="text-foreground-subtle">
            {nameMode
              ? "Type a card name above to start searching."
              : "Describe the artwork you remember — subjects, action, mood, colors, setting."}
          </p>
        ) : null}

        {hasQuery && error == null && cards.length === 0 ? (
          <p className="text-foreground-subtle">No cards found for &ldquo;{query}&rdquo;.</p>
        ) : null}

        {cards.length > 0 ? (
          <section>
            <p className="mb-4 text-sm text-foreground-subtle" data-testid="result-summary">
              {cards.length} cards{engineNote != null ? ` · ${engineNote}` : ""}
            </p>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {cards.map(card => {
                const owned = ownedQuantities.get(card.cardId);
                return (
                  <li key={card.cardId} className="flex flex-col" data-testid={`art-result-${card.cardId}`}>
                    <a
                      href={card.imageLarge}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <Image
                        src={card.imageSmall}
                        alt={card.name}
                        width={245}
                        height={342}
                        className="h-auto w-full rounded-field shadow-card transition-transform group-hover:scale-[1.03]"
                      />
                      <div className="mt-2">
                        <p className="truncate font-medium text-foreground">{card.name}</p>
                        <p className="truncate text-sm text-foreground-subtle">
                          {card.setName} · {card.number}
                        </p>
                        {card.matched.length > 0 ? (
                          <p className="truncate text-xs text-foreground-subtle">
                            matched: {card.matched.slice(0, 4).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </a>
                    {user != null ? (
                      <div className="mt-2 flex items-center gap-2">
                        <form action={addCardToCollection} className="flex-1">
                          <input type="hidden" name="cardId" value={card.cardId} />
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            className="w-full whitespace-nowrap px-2"
                            data-testid={`add-${card.cardId}`}
                          >
                            {owned != null ? "+ Add another" : "+ Add to binder"}
                          </Button>
                        </form>
                        {owned != null ? (
                          <Badge variant="solid" size="sm" data-testid={`owned-${card.cardId}`}>
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
