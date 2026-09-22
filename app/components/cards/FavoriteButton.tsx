"use client";

import { useOptimistic, useTransition } from "react";

import { toggleFavorite } from "@/lib/favorites/actions";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  cardId: string;
  cardName: string;
  saved: boolean;
  // "overlay" floats on a card image corner; "labeled" is the card-detail
  // button with text next to the heart.
  appearance?: "overlay" | "labeled";
  className?: string;
}

const HeartIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="h-5 w-5"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19.5 12.6 12 20l-7.5-7.4a5 5 0 1 1 7-7.1l.5.5.5-.5a5 5 0 1 1 7 7.1Z" />
  </svg>
);

// The one-tap save. Optimistic: the heart flips immediately while the server
// action commits; the revalidated page then confirms (or reverts) it.
const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  cardId,
  cardName,
  saved,
  appearance = "overlay",
  className,
}) => {
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [, startTransition] = useTransition();

  const onToggle = (): void => {
    startTransition(async () => {
      setOptimisticSaved(!optimisticSaved);
      const formData = new FormData();
      formData.set("cardId", cardId);
      await toggleFavorite(formData);
    });
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={optimisticSaved}
      aria-label={optimisticSaved ? `Remove ${cardName} from saves` : `Save ${cardName}`}
      data-testid={`fav-${cardId}`}
      data-saved={optimisticSaved ? "true" : "false"}
      className={cn(
        appearance === "overlay"
          ? "inline-flex items-center justify-center rounded-pill bg-surface/90 p-2 text-foreground shadow-card transition-colors hover:bg-surface"
          : "inline-flex items-center gap-2 rounded-pill border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover",
        className,
      )}
    >
      <HeartIcon filled={optimisticSaved} />
      {appearance === "labeled" ? (optimisticSaved ? "Saved" : "Save") : null}
    </button>
  );
};

export default FavoriteButton;
