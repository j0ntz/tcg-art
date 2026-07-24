import Image from "next/image";
import Link from "next/link";

import { removeCardFromDeck } from "@/lib/decks/actions";
import type { FacetCard } from "@/lib/facets";
import AddToDeckMenu, { type DeckOption } from "./AddToDeckMenu";
import FavoriteButton from "./FavoriteButton";

interface CardGridProps {
  cards: FacetCard[];
  signedIn: boolean;
  savedIds: ReadonlySet<string>;
  decks: DeckOption[];
  // When set, tiles belong to this deck's page and offer "Remove" instead of
  // the add-to-deck menu.
  removeDeckId?: string;
}

// The uniform art grid: the workhorse card view on search, saves, and deck
// pages. Each tile links to the card detail and carries the save heart plus
// deck controls.
const CardGrid: React.FC<CardGridProps> = ({ cards, signedIn, savedIds, decks, removeDeckId }) => (
  <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    {cards.map(card => (
      <li key={card.cardId} className="flex flex-col" data-testid={`card-tile-${card.cardId}`}>
        <div className="relative">
          <Link href={`/card/${card.cardId}`} className="group block">
            <Image
              src={card.imageSmall}
              alt={`${card.name} card art`}
              width={245}
              height={342}
              className="h-auto w-full rounded-field shadow-card transition-transform motion-safe:group-hover:-translate-y-1"
            />
          </Link>
          {signedIn ? (
            <FavoriteButton
              cardId={card.cardId}
              cardName={card.name}
              saved={savedIds.has(card.cardId)}
              className="absolute right-1.5 top-1.5"
            />
          ) : (
            <Link
              href="/login"
              aria-label={`Sign in to save ${card.name}`}
              data-testid={`fav-login-${card.cardId}`}
              className="absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded-pill bg-surface/90 p-2 text-foreground-subtle shadow-card transition-colors hover:text-foreground"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19.5 12.6 12 20l-7.5-7.4a5 5 0 1 1 7-7.1l.5.5.5-.5a5 5 0 1 1 7 7.1Z" />
              </svg>
            </Link>
          )}
        </div>

        <div className="mt-2 flex items-start justify-between gap-2">
          <Link href={`/card/${card.cardId}`} className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{card.name}</p>
            <p className="truncate text-xs text-foreground-subtle">
              {card.setName} · {card.number}
            </p>
            {card.artist != null ? (
              <p className="truncate text-xs text-foreground-faint">{card.artist}</p>
            ) : null}
          </Link>
          {signedIn ? (
            removeDeckId != null ? (
              <form action={removeCardFromDeck} className="shrink-0">
                <input type="hidden" name="deckId" value={removeDeckId} />
                <input type="hidden" name="cardId" value={card.cardId} />
                <button
                  type="submit"
                  data-testid={`deck-remove-${card.cardId}`}
                  className="rounded-pill border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  Remove
                </button>
              </form>
            ) : (
              <AddToDeckMenu cardId={card.cardId} decks={decks} className="shrink-0" />
            )
          ) : null}
        </div>
      </li>
    ))}
  </ul>
);

export default CardGrid;
