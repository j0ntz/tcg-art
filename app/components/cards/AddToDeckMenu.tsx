"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { DECK_NAME_MAX } from "@/lib/decks/name";
import { addCardToDeck, createDeck } from "@/lib/decks/actions";
import { cn } from "@/lib/utils";

export interface DeckOption {
  id: string;
  name: string;
}

interface AddToDeckMenuProps {
  cardId: string;
  decks: DeckOption[];
  // Deck ids already containing this card (known on the card detail page;
  // grids pass none and rely on the idempotent add).
  memberOf?: string[];
  className?: string;
}

// "+ Deck" popover: add the card to any existing deck or create a new deck
// born holding it. Adds are optimistic per deck row; adding twice is a no-op
// server-side, so grid tiles can offer every deck without per-card membership
// queries.
const AddToDeckMenu: React.FC<AddToDeckMenuProps> = ({ cardId, decks, memberOf, className }) => {
  const [open, setOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set(memberOf ?? []));
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current != null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onAdd = (deckId: string): void => {
    startTransition(async () => {
      setAddedIds(previous => new Set([...previous, deckId]));
      const formData = new FormData();
      formData.set("deckId", deckId);
      formData.set("cardId", cardId);
      await addCardToDeck(formData);
    });
  };

  const onCreate = (formData: FormData): void => {
    startTransition(async () => {
      setCreating(true);
      formData.set("cardId", cardId);
      await createDeck(formData);
      setCreating(false);
      setOpen(false);
    });
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(previous => !previous)}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid={`deck-menu-${cardId}`}
        className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-pill border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
      >
        + Deck
      </button>

      {open ? (
        <div
          className="absolute right-0 z-30 mt-2 w-56 rounded-card border border-border bg-surface p-2 shadow-float"
          data-testid={`deck-menu-panel-${cardId}`}
        >
          {decks.length > 0 ? (
            <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
              {decks.map(deck => {
                const added = addedIds.has(deck.id);
                return (
                  <li key={deck.id}>
                    <button
                      type="button"
                      onClick={() => onAdd(deck.id)}
                      disabled={added}
                      data-testid={`deck-add-${deck.id}-${cardId}`}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-field px-3 py-2 text-left text-sm transition-colors",
                        added
                          ? "text-foreground-subtle"
                          : "text-foreground hover:bg-surface-hover",
                      )}
                    >
                      <span className="truncate">{deck.name}</span>
                      {added ? <span aria-hidden>✓</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-foreground-subtle">No decks yet.</p>
          )}

          <form action={onCreate} className="mt-1 flex gap-1 border-t border-border pt-2">
            <input
              type="text"
              name="name"
              required
              maxLength={DECK_NAME_MAX}
              placeholder="New deck name"
              aria-label="New deck name"
              data-testid={`deck-create-name-${cardId}`}
              className="w-full min-w-0 flex-1 rounded-field border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-foreground focus:border-foreground-subtle"
            />
            <button
              type="submit"
              disabled={creating}
              data-testid={`deck-create-submit-${cardId}`}
              className="rounded-pill bg-surface-inverse px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-surface-inverse-hover disabled:opacity-50"
            >
              Create
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default AddToDeckMenu;
