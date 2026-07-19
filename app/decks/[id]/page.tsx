import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { DECK_NAME_MAX, getDeck, getDeckCards, getDecks } from "@/lib/decks";
import { deleteDeck, renameDeck } from "@/lib/decks/actions";
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
import { getFavoriteCardIds } from "@/lib/favorites";
import { cn } from "@/lib/utils";
import CardGrid from "../../components/cards/CardGrid";
import FacetControls, { type SortOption } from "../../components/cards/FacetControls";
import FocusCarousel, { type CarouselEntry } from "../../components/cards/FocusCarousel";
import ViewToggle from "../../components/cards/ViewToggle";
import Badge from "../../components/ui/Badge";
import { buttonVariants } from "../../components/ui/Button";
import { cardVariants } from "../../components/ui/Card";

export const metadata: Metadata = {
  title: "Deck — TCG-Art",
  description: "One deck's cards, with the full filter and sort set.",
};

interface DeckPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<FacetSearchParams & { view?: string }>;
}

const addedFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DECK_SORTS: SortOption[] = SORTS.filter(sort => sort.key !== "relevance").map(sort => ({
  key: sort.key,
  label: sort.key === "recent" ? "Recently added" : sort.label,
}));

// One deck: standard grid with the same filters/sorts as saves, the carousel
// as the alternate view, and rename/delete management. Ownership-checked:
// another user's deck id 404s.
const DeckPage = async ({ params, searchParams }: DeckPageProps) => {
  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const { id } = await params;
  const query = await searchParams;
  const view = query.view === "carousel" ? "carousel" : "grid";
  const state = parseFacetState(query);

  const deck = await getDeck(user.id, id);
  if (deck == null) notFound();

  const items = await getDeckCards(deck.id);

  let cardLookupError: string | null = null;
  let deckCardsById: Awaited<ReturnType<typeof resolveFacetCards>> = new Map();
  if (items.length > 0) {
    try {
      deckCardsById = await resolveFacetCards(items.map(item => item.cardId));
    } catch (e: unknown) {
      cardLookupError = e instanceof Error ? e.message : "Card lookup failed";
    }
  }

  const orderedItems = items.filter(item => deckCardsById.has(item.cardId));
  const allCards = orderedItems.map(item => deckCardsById.get(item.cardId)!);
  const addedLabelByCard = new Map(
    orderedItems.map(item => [item.cardId, `Added ${addedFormat.format(item.addedAt)}`]),
  );

  const groups = buildFacetGroups(allCards, state);
  const cards = sortFacetCards(applyFacetFilters(allCards, state), state.sort ?? "recent");
  const savedIds = await getFavoriteCardIds(user.id);
  const decks = (await getDecks(user.id)) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-gutter py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-foreground-subtle">
        <Link href="/decks" className="underline underline-offset-4 transition-colors hover:text-foreground">
          Decks
        </Link>{" "}
        / {deck.name}
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1
            className="font-display text-heading font-semibold tracking-tight text-foreground"
            data-testid="deck-title"
          >
            {deck.name}
          </h1>
          <Badge variant="soft" size="md" data-testid="deck-card-count">
            {items.length} {items.length === 1 ? "card" : "cards"}
          </Badge>
        </div>
        {items.length > 0 ? <ViewToggle view={view} params={query} /> : null}
      </header>

      {items.length === 0 ? (
        <div
          className={cn(cardVariants(), "flex flex-col items-center gap-4 p-10 text-center sm:p-16")}
          data-testid="deck-empty"
        >
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-foreground">
              This deck is empty
            </h2>
            <p className="max-w-sm text-foreground-muted">
              Use “+ Deck” on any card in search or your saves to add it here.
            </p>
          </div>
          <Link href="/search" className={buttonVariants({ variant: "primary", size: "md" })}>
            Search cards
          </Link>
        </div>
      ) : cardLookupError != null ? (
        <div className={cn(cardVariants(), "p-8")}>
          <p className="text-danger">
            Could not load card data right now: {cardLookupError}. The deck&rsquo;s {items.length}{" "}
            {items.length === 1 ? "card is" : "cards are"} safe; reload to try again.
          </p>
        </div>
      ) : view === "carousel" ? (
        <FocusCarousel
          entries={cards.map(
            (card): CarouselEntry => ({
              card,
              savedLabel: addedLabelByCard.get(card.cardId) ?? null,
            }),
          )}
        />
      ) : (
        <FacetControls
          groups={groups}
          sortOptions={DECK_SORTS}
          appliedSort={state.sort}
          defaultSort="recent"
          resultCount={cards.length}
          showCounts
        >
          {cards.length === 0 ? (
            <div className="flex max-w-xl flex-col gap-2" data-testid="deck-no-match">
              <p className="font-medium text-foreground">
                No {hasActiveFilters(state) ? "matching " : ""}cards in this deck yet.
              </p>
              <p className="text-sm text-foreground-muted">
                Remove a filter above to widen the view.
              </p>
            </div>
          ) : (
            <CardGrid
              cards={cards}
              signedIn
              savedIds={savedIds}
              decks={decks}
              removeDeckId={deck.id}
            />
          )}
        </FacetControls>
      )}

      <section className="flex flex-col gap-4 border-t border-border pt-6" aria-label="Manage deck">
        <h2 className="font-display text-lg font-semibold text-foreground">Manage</h2>
        <form action={renameDeck} className="flex w-full max-w-md gap-3">
          <input type="hidden" name="deckId" value={deck.id} />
          <input
            type="text"
            name="name"
            required
            maxLength={DECK_NAME_MAX}
            defaultValue={deck.name}
            aria-label="Deck name"
            data-testid="deck-rename-name"
            className="min-w-0 flex-1 rounded-pill border border-border-strong bg-surface px-5 py-2.5 text-foreground focus:border-foreground-subtle"
          />
          <button
            type="submit"
            data-testid="deck-rename-submit"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Rename
          </button>
        </form>
        <form action={deleteDeck}>
          <input type="hidden" name="deckId" value={deck.id} />
          <button
            type="submit"
            data-testid="deck-delete"
            className="text-sm text-danger underline underline-offset-4 transition-colors hover:opacity-80"
          >
            Delete this deck
          </button>
        </form>
      </section>
    </main>
  );
};

export default DeckPage;
