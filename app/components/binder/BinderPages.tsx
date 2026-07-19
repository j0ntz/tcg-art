"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import RemoveCardForm from "./RemoveCardForm";
import type { BinderEntry } from "./types";

interface BinderPagesProps {
  entries: BinderEntry[];
}

// A physical binder page holds a fixed 3x3 sheet of pockets; unfilled pockets
// render as empty sleeves, which is what makes it read as a binder and not a
// plain grid.
const SLOTS_PER_PAGE = 9;

const BinderPages: React.FC<BinderPagesProps> = ({ entries }) => {
  const [pageIndex, setPageIndex] = useState(0);

  const pages = useMemo(() => {
    const chunks: BinderEntry[][] = [];
    for (let i = 0; i < entries.length; i += SLOTS_PER_PAGE) {
      chunks.push(entries.slice(i, i + SLOTS_PER_PAGE));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [entries]);

  // Removing cards can shrink the page count under the cursor; clamp instead
  // of storing (avoids a state/props sync effect).
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const page = pages[safePageIndex];
  const slots: Array<BinderEntry | null> = [
    ...page,
    ...Array<null>(SLOTS_PER_PAGE - page.length).fill(null),
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="binder-pages">
      <div className="[perspective:1600px]">
        {/* Keyed on the page so turning a page remounts the sheet and replays
            the flip-in; reduced-motion users get an instant swap. */}
        <div
          key={safePageIndex}
          className={cn(
            "relative rounded-panel border border-border bg-surface-muted p-4 pl-9 shadow-card sm:p-6 sm:pl-12",
            "origin-left motion-safe:animate-page-turn",
          )}
        >
          {/* Binder rings on the spine edge. */}
          <div aria-hidden className="absolute inset-y-0 left-2.5 flex flex-col justify-around py-8 sm:left-4">
            {[0, 1, 2].map(ring => (
              <span
                key={ring}
                className="h-4 w-4 rounded-pill border-2 border-border-strong bg-surface shadow-card"
              />
            ))}
          </div>

          <ul className="grid grid-cols-3 gap-2 sm:gap-4">
            {slots.map((entry, slotIndex) =>
              entry != null ? (
                <li key={entry.card.id} className="group relative">
                  <Link
                    href={`/card/${entry.card.id}`}
                    className="block rounded-field bg-surface p-1 shadow-card transition-transform motion-safe:group-hover:scale-[1.02] sm:p-1.5"
                  >
                    <Image
                      src={entry.card.images.small}
                      alt={entry.card.name}
                      width={245}
                      height={342}
                      className="h-auto w-full rounded-[4px]"
                    />
                  </Link>
                  {entry.quantity > 1 ? (
                    <Badge
                      variant="solid"
                      size="sm"
                      className="pointer-events-none absolute right-1 top-1"
                    >
                      ×{entry.quantity}
                    </Badge>
                  ) : null}
                  <RemoveCardForm
                    cardId={entry.card.id}
                    cardName={entry.card.name}
                    className="absolute left-1 top-1"
                  />
                </li>
              ) : (
                <li
                  key={`empty-${slotIndex}`}
                  aria-hidden
                  className="aspect-[245/342] rounded-field border-2 border-dashed border-border bg-surface/50"
                />
              ),
            )}
          </ul>
        </div>
      </div>

      {pages.length > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={safePageIndex === 0}
            onClick={() => setPageIndex(safePageIndex - 1)}
            className="disabled:opacity-40"
            data-testid="binder-prev"
          >
            ← Prev
          </Button>
          <p className="text-sm text-foreground-subtle" data-testid="binder-page-label">
            Page {safePageIndex + 1} of {pages.length}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={safePageIndex === pages.length - 1}
            onClick={() => setPageIndex(safePageIndex + 1)}
            className="disabled:opacity-40"
            data-testid="binder-next"
          >
            Next →
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default BinderPages;
