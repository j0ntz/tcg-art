import Link from "next/link";
import type { Metadata } from "next";

import { searchArt } from "@/lib/art-search";
import { getSessionUser } from "@/lib/auth";
import { getDecks } from "@/lib/decks";
import {
  apiOrderByFor,
  applyFacetFilters,
  buildFacetGroups,
  facetCardFromApiCard,
  facetCardFromIndexEntry,
  facetLuceneClauses,
  hasActiveFilters,
  applyFacetStateToParams,
  parseFacetState,
  sortFacetCards,
  stripVisionFacets,
  type FacetCard,
  type FacetState,
} from "@/lib/facets";
import { getFavoriteCardIds } from "@/lib/favorites";
import {
  searchCards,
  searchCardsByArtist,
  SEARCH_PAGE_SIZE,
} from "@/lib/pokemon";
import CardGrid from "../components/cards/CardGrid";
import FacetControls, { type SortOption } from "../components/cards/FacetControls";
import Button, { buttonVariants } from "../components/ui/Button";

export const metadata: Metadata = {
  title: "Search",
  description: "Describe the art you remember and find the card, or search by exact name.",
};

interface SearchProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
// paginating. The full ranked set (the cap) is always fetched so facet counts
// describe the query's whole result set, not the visible slice.
const ART_LIMIT_DEFAULT = 24;
const ART_LIMIT_MAX = 96;

// Sorts per engine: relevance is the art ranker's own order; hue needs the
// vision palette, so it is art-only. Name/artist mode sorts map to the API's
// orderBy and default to alphabetical.
const ART_SORTS: SortOption[] = [
  { key: "relevance", label: "Best match" },
  { key: "newest", label: "Newest era" },
  { key: "oldest", label: "Oldest era" },
  { key: "dex", label: "Pokédex order" },
  { key: "az", label: "Alphabetical" },
  { key: "hue", label: "By color" },
];
const NAME_SORTS: SortOption[] = [
  { key: "az", label: "Alphabetical" },
  { key: "newest", label: "Newest era" },
  { key: "oldest", label: "Oldest era" },
  { key: "dex", label: "Pokédex order" },
];
// Artist mode's API default is -set.releaseDate, so its dropdown defaults to
// "Newest era"; listing it first keeps the dropdown honest about that order.
const ARTIST_SORTS: SortOption[] = [
  { key: "newest", label: "Newest era" },
  { key: "oldest", label: "Oldest era" },
  { key: "az", label: "Alphabetical" },
  { key: "dex", label: "Pokédex order" },
];

type SearchMode = "art" | "name" | "artist";

const firstOf = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

// Rebuilds the current URL with overrides, preserving facet/sort state so
// mode switches, pagination, and show-more never drop applied filters.
const searchHref = (
  mode: SearchMode,
  query: string,
  state: FacetState,
  overrides: Record<string, string | null> = {},
): string => {
  const params = new URLSearchParams();
  if (mode !== "art") params.set("mode", mode);
  if (query.length > 0) params.set("q", query);
  applyFacetStateToParams(state, params);
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs.length > 0 ? `/search?${qs}` : "/search";
};

const SearchPage = async ({ searchParams }: SearchProps) => {
  const params = await searchParams;
  const query = (firstOf(params.q) ?? "").trim();
  // Semantic art search is the primary mode; exact-name search stays available
  // as the fallback/filter mode via ?mode=name. ?mode=artist is reached from
  // the artist attribution link on a card detail page.
  const rawMode = firstOf(params.mode);
  const mode: SearchMode = rawMode === "name" ? "name" : rawMode === "artist" ? "artist" : "art";
  const page = Math.max(1, Number.parseInt(firstOf(params.page) ?? "1", 10) || 1);
  const artLimit = Math.min(
    ART_LIMIT_MAX,
    Math.max(ART_LIMIT_DEFAULT, Number.parseInt(firstOf(params.n) ?? "0", 10) || 0),
  );
  // Name/artist mode filters API-side via Lucene clauses, which have no field
  // for the vision facets; strip them so a carried color/mood selection never
  // renders a chip that filters nothing.
  const parsedState = parseFacetState(params);
  const state = mode === "art" ? parsedState : stripVisionFacets(parsedState);

  let cards: FacetCard[] = [];
  // Art mode's full ranked set: facet counts are computed over it so they
  // describe the query's whole result set, not the visible slice.
  let artRanked: FacetCard[] = [];
  let engineNote: string | null = null;
  let error: string | null = null;
  let totalCount: number | null = null;
  let artMatchTotal = 0;
  if (query.length > 0) {
    try {
      if (mode === "name" || mode === "artist") {
        // Facet selections filter API-side as Lucene clauses; the chosen sort
        // maps to the API's orderBy.
        const options = { clauses: facetLuceneClauses(state), orderBy: apiOrderByFor(state.sort) };
        const result =
          mode === "name"
            ? await searchCards(query, page, options)
            : await searchCardsByArtist(query, page, options);
        cards = result.cards.map(facetCardFromApiCard);
        totalCount = result.totalCount;
      } else {
        const response = await searchArt(query, ART_LIMIT_MAX);
        artRanked = response.results.map(result => facetCardFromIndexEntry(result.entry));
        const filtered = applyFacetFilters(artRanked, state);
        artMatchTotal = filtered.length;
        cards = sortFacetCards(filtered, state.sort ?? "relevance").slice(0, artLimit);
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
  const filtersActive = hasActiveFilters(state);
  const totalPages =
    totalCount != null ? Math.max(1, Math.ceil(totalCount / SEARCH_PAGE_SIZE)) : null;

  // Facet option lists: art mode counts over the query's full ranked set; API
  // modes derive options from the current page (no local data to count), so
  // counts are hidden there.
  const groups = buildFacetGroups(mode === "art" ? artRanked : cards, state);

  // Logged-in searchers get the save heart and deck menu on every result;
  // logged-out searchers get a sign-in prompt on the heart.
  const user = await getSessionUser();
  const [savedIds, decks] =
    user != null
      ? await Promise.all([getFavoriteCardIds(user.id), getDecks(user.id)])
      : [new Set<string>(), null];

  const modeToggle = (
    <div className="flex items-center gap-2 text-sm" data-testid="search-mode-toggle">
      <Link
        href={searchHref("art", query, state, { sort: null })}
        aria-current={mode === "art" ? "page" : undefined}
        className={
          mode === "art"
            ? "rounded-pill bg-surface-inverse px-4 py-1.5 font-medium text-primary-foreground"
            : "rounded-pill border border-border-strong px-4 py-1.5 font-medium text-foreground-muted transition-colors hover:text-foreground"
        }
      >
        Describe the art
      </Link>
      <Link
        href={searchHref("name", query, stripVisionFacets(state), { sort: null })}
        aria-current={mode === "name" ? "page" : undefined}
        className={
          mode === "name"
            ? "rounded-pill bg-surface-inverse px-4 py-1.5 font-medium text-primary-foreground"
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

  const resultCount = mode === "art" ? artMatchTotal : totalCount ?? cards.length;

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-border">
        <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-gutter py-10 sm:py-14">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-heading font-semibold tracking-tight text-foreground sm:text-title">
              {heading}
            </h1>
            <p className="max-w-xl text-lead text-foreground-muted">
              {mode === "artist"
                ? "Every card in the database credited to this illustrator, newest first."
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
                      href={`/search?q=${encodeURIComponent(example)}`}
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

        {hasQuery && error == null ? (
          <section className="flex flex-col gap-4">
            {engineNote != null ? (
              <p className="tnum text-sm text-foreground-subtle" data-testid="result-summary">
                {engineNote}
                {totalPages != null && totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
              </p>
            ) : totalPages != null && totalPages > 1 ? (
              <p className="tnum text-sm text-foreground-subtle" data-testid="result-summary">
                page {page} of {totalPages}
              </p>
            ) : null}

            <FacetControls
              groups={groups}
              sortOptions={
                mode === "art" ? ART_SORTS : mode === "artist" ? ARTIST_SORTS : NAME_SORTS
              }
              appliedSort={state.sort}
              defaultSort={mode === "art" ? "relevance" : mode === "artist" ? "newest" : "az"}
              resultCount={resultCount}
              showCounts={mode === "art"}
            >
              {cards.length === 0 ? (
                <div className="flex max-w-xl flex-col gap-3" data-testid="search-empty">
                  <p className="font-medium text-foreground">
                    No cards found for &ldquo;{query}&rdquo;
                    {filtersActive ? " with these filters" : ""}.
                  </p>
                  <p className="text-sm text-foreground-muted">
                    {filtersActive
                      ? "Remove a filter above, or clear all to see every match."
                      : mode === "art"
                        ? "Try fewer or different words, or switch to exact-name search above."
                        : mode === "artist"
                          ? "This illustrator has no cards in the database."
                          : "Check the spelling, or try describing the artwork instead."}
                  </p>
                </div>
              ) : (
                <>
                  <CardGrid
                    cards={cards}
                    signedIn={user != null}
                    savedIds={savedIds}
                    decks={decks ?? []}
                  />

                  {mode === "art" && artMatchTotal > artLimit ? (
                    <div className="mt-8 flex justify-center">
                      <Link
                        href={searchHref("art", query, state, {
                          n: String(Math.min(ART_LIMIT_MAX, artLimit * 2)),
                        })}
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
                          href={searchHref(mode, query, state, { page: String(page - 1) })}
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
                          href={searchHref(mode, query, state, { page: String(page + 1) })}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          Next →
                        </Link>
                      ) : (
                        <span />
                      )}
                    </nav>
                  ) : null}
                </>
              )}
            </FacetControls>
          </section>
        ) : null}
      </div>
    </main>
  );
};

export default SearchPage;
