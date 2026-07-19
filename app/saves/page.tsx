import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getDecks } from "@/lib/decks";
import {
  applyFacetFilters,
  buildFacetGroups,
  hasActiveFilters,
  parseFacetState,
  sortFacetCards,
  SORTS,
  type FacetSearchParams,
} from "@/lib/facets";
import { resolveFacetCards } from "@/lib/facets/resolve";
import { getFavorites } from "@/lib/favorites";
import { cn } from "@/lib/utils";
import CardGrid from "../components/cards/CardGrid";
import FacetControls, { type SortOption } from "../components/cards/FacetControls";
import FocusCarousel, { type CarouselEntry } from "../components/cards/FocusCarousel";
import ViewToggle from "../components/cards/ViewToggle";
import { buttonVariants } from "../components/ui/Button";
import { cardVariants } from "../components/ui/Card";

export const metadata: Metadata = {
  title: "Your Saves",
  description: "Every card you have saved, with filters and sorts over the full set.",
};

interface SavesPageProps {
  searchParams: Promise<FacetSearchParams & { view?: string }>;
}

const savedFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Sorts offered over saved cards: save recency is the default; "Best match"
// is search-only.
const SAVES_SORTS: SortOption[] = SORTS.filter(sort => sort.key !== "relevance").map(sort => ({
  key: sort.key,
  label: sort.label,
}));

// Auth-gated saves gallery (same server-side session gate as /account). Card
// display data comes from the art index with an API fallback; only card ids
// live in our database.
const SavesPage = async ({ searchParams }: SavesPageProps) => {
  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const params = await searchParams;
  const view = params.view === "carousel" ? "carousel" : "grid";
  const state = parseFacetState(params);

  const items = await getFavorites(user.id);

  if (items == null) {
    return (
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-gutter py-10">
        <h1 className="font-display text-heading font-semibold tracking-tight text-foreground">
          Your Saves
        </h1>
        <div className={cn(cardVariants(), "p-8 text-foreground-muted")}>
          Save storage is not provisioned on this deployment yet. See docs/auth-setup.md for the
          database setup.
        </div>
      </main>
    );
  }

  let cardLookupError: string | null = null;
  let savedCards: Awaited<ReturnType<typeof resolveFacetCards>> = new Map();
  if (items.length > 0) {
    try {
      savedCards = await resolveFacetCards(items.map(item => item.cardId));
    } catch (e: unknown) {
      cardLookupError = e instanceof Error ? e.message : "Card lookup failed";
    }
  }

  // Saved order (newest first) IS the default "recent" sort; explicit sorts
  // re-order from there.
  const orderedItems = items.filter(item => savedCards.has(item.cardId));
  const allCards = orderedItems.map(item => savedCards.get(item.cardId)!);
  const savedLabelByCard = new Map(
    orderedItems.map(item => [item.cardId, `Saved ${savedFormat.format(item.savedAt)}`]),
  );

  const groups = buildFacetGroups(allCards, state);
  const cards = sortFacetCards(applyFacetFilters(allCards, state), state.sort ?? "recent");
  const decks = (await getDecks(user.id)) ?? [];
  const savedIds = new Set(allCards.map(card => card.cardId));

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-gutter py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-heading font-semibold tracking-tight text-foreground">
          Your Saves
        </h1>
        {items.length > 0 ? <ViewToggle view={view} params={params} /> : null}
      </header>

      {items.length === 0 ? (
        <div
          className={cn(cardVariants(), "flex flex-col items-center gap-4 p-10 text-center sm:p-16")}
          data-testid="saves-empty"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-12 w-12 text-border-strong"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19.5 12.6 12 20l-7.5-7.4a5 5 0 1 1 7-7.1l.5.5.5-.5a5 5 0 1 1 7 7.1Z" />
          </svg>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Nothing saved yet
            </h2>
            <p className="max-w-sm text-foreground-muted">
              Tap the heart on any card to save it here. Start from a search for the art you
              remember.
            </p>
          </div>
          <Link href="/search" className={buttonVariants({ variant: "primary", size: "md" })}>
            Search cards
          </Link>
        </div>
      ) : cardLookupError != null ? (
        <div className={cn(cardVariants(), "p-8")}>
          <p className="text-danger">
            Could not load card data right now: {cardLookupError}. Your {items.length} saved{" "}
            {items.length === 1 ? "card is" : "cards are"} safe; reload to try again.
          </p>
        </div>
      ) : view === "carousel" ? (
        <FocusCarousel
          entries={cards.map(
            (card): CarouselEntry => ({
              card,
              savedLabel: savedLabelByCard.get(card.cardId) ?? null,
            }),
          )}
        />
      ) : (
        <FacetControls
          groups={groups}
          sortOptions={SAVES_SORTS}
          appliedSort={state.sort}
          defaultSort="recent"
          resultCount={cards.length}
          showCounts
        >
          {cards.length === 0 ? (
            <div className="flex max-w-xl flex-col gap-2" data-testid="saves-no-match">
              <p className="font-medium text-foreground">No saved cards match these filters.</p>
              <p className="text-sm text-foreground-muted">
                Remove a filter above to widen the view.
              </p>
            </div>
          ) : (
            <CardGrid cards={cards} signedIn savedIds={savedIds} decks={decks} />
          )}
        </FacetControls>
      )}
      {view === "carousel" && hasActiveFilters(state) && cards.length === 0 ? (
        <p className="text-sm text-foreground-muted" data-testid="saves-no-match">
          No saved cards match these filters.
        </p>
      ) : null}
    </main>
  );
};

export default SavesPage;
