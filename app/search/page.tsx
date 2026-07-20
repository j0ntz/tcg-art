import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { getOwnedQuantities } from "@/lib/collection";
import { addCardToCollection } from "@/lib/collection/actions";
import { searchArt, type ArtSearchResult } from "@/lib/art-search";
import {
  searchCards,
  searchCardsByArtist,
  SEARCH_PAGE_SIZE,
  type Card,
} from "@/lib/pokemon";
import Badge from "../components/ui/Badge";
import Button, { buttonVariants } from "../components/ui/Button";

export const metadata: Metadata = {
  title: "Search",
  description: "Describe the art you remember and find the card, or search by exact name.",
};

interface SearchProps {
  searchParams: Promise<{ q?: string; mode?: string; page?: string; n?: string }>;
}

// A row the results grid can render regardless of which engine produced it.
interface GridCard {
  cardId: string;
  name: string;
  setName: string;
  number: string;
  artist: string | null;
  imageSmall: string;
}

// Real queries the empty state offers as starting points; each is a known-good
// case from the e2e suite, never placeholder content.
const EXAMPLE_QUERIES = [
  "surfing pikachu",
  "sad ghost in the rain",
  "red dragon over a volcano",
  "green bug in the forest",
];

// Art mode serves a ranked list; "Show more" deepens the slice instead of
// paginating. Capped so a single request can't ask for the whole index.
const ART_LIMIT_DEFAULT = 24;
const ART_LIMIT_MAX = 96;

const fromArtResult = ({ entry }: ArtSearchResult): GridCard => ({
  cardId: entry.cardId,
  name: entry.name,
  setName: entry.setName,
  number: entry.number,
  artist: entry.artist,
  imageSmall: entry.imageSmall,
});

const fromCard = (card: Card): GridCard => ({
  cardId: card.id,
  name: card.name,
  setName: card.set.name,
  number: card.number,
  artist: card.artist,
  imageSmall: card.images.small,
});

type SearchMode = "art" | "name" | "artist";

const searchHref = (mode: SearchMode, query: string, page?: number): string => {
  const params = new URLSearchParams();
  if (mode !== "art") params.set("mode", mode);
  if (query.length > 0) params.set("q", query);
  if (page != null && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs.length > 0 ? `/search?${qs}` : "/search";
};

const SearchPage = async ({ searchParams }: SearchProps) => {
  const { q, mode: rawMode, page: rawPage, n: rawN } = await searchParams;
  const query = (q ?? "").trim();
  // Semantic art search is the primary mode; exact-name search stays available
  // as the fallback/filter mode via ?mode=name. ?mode=artist is reached from
  // the artist attribution link on a card detail page.
  const mode: SearchMode = rawMode === "name" ? "name" : rawMode === "artist" ? "artist" : "art";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const artLimit = Math.min(
    ART_LIMIT_MAX,
    Math.max(ART_LIMIT_DEFAULT, Number.parseInt(rawN ?? "0", 10) || 0),
  );

  let cards: GridCard[] = [];
  let engineNote: string | null = null;
  let error: string | null = null;
  let totalCount: number | null = null;
  if (query.length > 0) {
    try {
      if (mode === "name") {
        const result = await searchCards(query, page);
        cards = result.cards.map(fromCard);
        totalCount = result.totalCount;
      } else if (mode === "artist") {
        const result = await searchCardsByArtist(query, page);
        cards = result.cards.map(fromCard);
        totalCount = result.totalCount;
      } else {
        const response = await searchArt(query, artLimit);
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
  const totalPages =
    totalCount != null ? Math.max(1, Math.ceil(totalCount / SEARCH_PAGE_SIZE)) : null;

  // Logged-in searchers get the add-to-binder path on every result, with
  // already-collected cards marked. Logged-out search is unchanged.
  const user = await getSessionUser();
  const ownedQuantities =
    user != null && cards.length > 0 ? await getOwnedQuantities(user.id) : new Map<string, number>();

  const modeToggle = (
    <div className="flex items-center gap-2 text-sm" data-testid="search-mode-toggle">
      <Link
        href={searchHref("art", query)}
        aria-current={mode === "art" ? "page" : undefined}
        className={
          mode === "art"
            ? "rounded-pill bg-surface-inverse px-4 py-1.5 font-medium text-foreground-on-inverse"
            : "rounded-pill border border-border-strong px-4 py-1.5 font-medium text-foreground-muted transition-colors hover:text-foreground"
        }
      >
        Describe the art
      </Link>
      <Link
        href={searchHref("name", query)}
        aria-current={mode === "name" ? "page" : undefined}
        className={
          mode === "name"
            ? "rounded-pill bg-surface-inverse px-4 py-1.5 font-medium text-foreground-on-inverse"
            : "rounded-pill border border-border-strong px-4 py-1.5 font-medium text-foreground-muted transition-colors hover:text-foreground"
        }
      >
        Exact name
      </Link>
    </div>
  );

  const heading =
    mode === "artist"
      ? `Illustrated by ${query.length > 0 ? query : "…"}`
      : mode === "name"
        ? "Find by card name"
        : "Describe the art";

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-border">
        <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-gutter py-10 sm:py-14">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-heading font-bold tracking-tight text-foreground sm:text-title">
              {heading}
            </h1>
            <p className="max-w-xl text-lead text-foreground-muted">
              {mode === "artist"
                ? "Every card this artist has drawn, newest first."
                : mode === "name"
                  ? "Search across 20,000+ Pokémon TCG cards by exact name."
                  : "Say what is IN the artwork — a scene, a mood, a color — and find the card."}
            </p>
          </div>

          {mode !== "artist" ? (
            <>
              <form action="/search" className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
                {mode === "name" ? <input type="hidden" name="mode" value="name" /> : null}
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder={
                    mode === "name"
                      ? "Try: charizard, surfing pikachu, mewtwo…"
                      : "Try: sad ghost in the rain, pikachu riding a wave…"
                  }
                  autoFocus
                  aria-label={mode === "name" ? "Search Pokémon cards by name" : "Describe the card art"}
                  className="flex-1 rounded-pill border border-border-strong bg-surface px-5 py-3 text-foreground focus:border-foreground-subtle"
                />
                <Button type="submit" variant="primary" size="lg">
                  Search
                </Button>
              </form>
              {modeToggle}
            </>
          ) : (
            <Link
              href="/search"
              className="text-sm text-foreground-subtle underline underline-offset-4 transition-colors hover:text-foreground"
            >
              ← Back to art search
            </Link>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-gutter py-10">
        {error != null ? (
          <div className="max-w-xl rounded-panel border border-danger-border p-6">
            <p className="font-medium text-danger">Search is having trouble right now.</p>
            <p className="mt-1 text-sm text-foreground-muted">{error}. Try again in a moment.</p>
          </div>
        ) : null}

        {!hasQuery ? (
          <div className="flex max-w-xl flex-col gap-4">
            <p className="text-foreground-subtle">
              {mode === "name"
                ? "Type a card name above to start searching."
                : "Describe the artwork you remember — subjects, action, mood, colors, setting. Or start from one of these:"}
            </p>
            {mode !== "name" ? (
              <ul className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map(example => (
                  <li key={example}>
                    <Link
                      href={searchHref("art", example)}
                      className="inline-block rounded-pill border border-border px-4 py-1.5 text-sm text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground"
                    >
                      {example}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {hasQuery && error == null && cards.length === 0 ? (
          <div className="flex max-w-xl flex-col gap-3" data-testid="search-empty">
            <p className="font-medium text-foreground">
              No cards found for &ldquo;{query}&rdquo;.
            </p>
            <p className="text-sm text-foreground-muted">
              {mode === "art"
                ? "Try fewer or different words, or switch to exact-name search above."
                : mode === "artist"
                  ? "This illustrator has no cards in the database."
                  : "Check the spelling, or try describing the artwork instead."}
            </p>
          </div>
        ) : null}

        {cards.length > 0 ? (
          <section>
            <p className="tnum mb-4 text-sm text-foreground-subtle" data-testid="result-summary">
              {totalCount != null ? `${totalCount.toLocaleString()} cards` : `${cards.length} cards`}
              {engineNote != null ? ` · ${engineNote}` : ""}
              {totalPages != null && totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
            </p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {cards.map(card => {
                const owned = ownedQuantities.get(card.cardId);
                return (
                  <li key={card.cardId} className="flex flex-col" data-testid={`art-result-${card.cardId}`}>
                    <Link href={`/card/${card.cardId}`} className="group block">
                      <Image
                        src={card.imageSmall}
                        alt={`${card.name} card art`}
                        width={245}
                        height={342}
                        className="h-auto w-full rounded-field shadow-card transition-transform motion-safe:group-hover:-translate-y-1"
                      />
                      <div className="mt-2">
                        <p className="truncate text-sm font-medium text-foreground">{card.name}</p>
                        <p className="truncate text-xs text-foreground-subtle">
                          {card.setName} · {card.number}
                        </p>
                        {card.artist != null ? (
                          <p className="truncate text-xs text-foreground-faint">{card.artist}</p>
                        ) : null}
                      </div>
                    </Link>
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

            {mode === "art" && cards.length >= artLimit && artLimit < ART_LIMIT_MAX ? (
              <div className="mt-8 flex justify-center">
                <Link
                  href={`/search?q=${encodeURIComponent(query)}&n=${Math.min(ART_LIMIT_MAX, artLimit * 2)}`}
                  className={buttonVariants({ variant: "secondary", size: "md" })}
                  data-testid="show-more"
                >
                  Show more matches
                </Link>
              </div>
            ) : null}

            {totalPages != null && totalPages > 1 ? (
              <nav
                className="mt-8 flex items-center justify-between"
                aria-label="Search result pages"
                data-testid="pagination"
              >
                {page > 1 ? (
                  <Link
                    href={searchHref(mode, query, page - 1)}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span />
                )}
                <p className="tnum text-sm text-foreground-subtle">
                  Page {page} of {totalPages}
                </p>
                {page < totalPages ? (
                  <Link
                    href={searchHref(mode, query, page + 1)}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Next →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default SearchPage;
