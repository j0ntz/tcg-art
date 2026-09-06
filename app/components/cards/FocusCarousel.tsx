"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { FacetCard } from "@/lib/facets";
import { cn } from "@/lib/utils";
import Button from "../ui/Button";
import { cardVariants } from "../ui/Card";

export interface CarouselEntry {
  card: FacetCard;
  // Pre-formatted "saved/added" date (formatted server-side with a fixed
  // locale so client hydration matches); null hides the line.
  savedLabel: string | null;
}

interface FocusCarouselProps {
  entries: CarouselEntry[];
}

// Art-forward focused carousel, retained from the binder era as the alternate
// view on saves and deck pages: a native scroll-snap strip (mobile swiping is
// free and momentum feels platform-native) with the centered card scaled up
// and its details on a placard below. Buttons are a convenience on top of the
// scroller, not the mechanism.
const FocusCarousel: React.FC<FocusCarouselProps> = ({ entries }) => {
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const slideRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller == null) return;
    // A slide is "active" when it enters the middle fifth of the scroller.
    const observer = new IntersectionObserver(
      hits => {
        for (const hit of hits) {
          if (!hit.isIntersecting) continue;
          const index = slideRefs.current.indexOf(hit.target as HTMLLIElement);
          if (index >= 0) setActiveIndex(index);
        }
      },
      { root: scroller, rootMargin: "0px -40% 0px -40%", threshold: 0 },
    );
    for (const slide of slideRefs.current) {
      if (slide != null) observer.observe(slide);
    }
    return () => observer.disconnect();
  }, [entries]);

  const safeActiveIndex = Math.min(activeIndex, entries.length - 1);
  const active = entries[safeActiveIndex];

  const scrollToIndex = (index: number): void => {
    const slide = slideRefs.current[index];
    if (slide == null) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    slide.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <div className="flex flex-col gap-5" data-testid="carousel">
      <ul
        ref={scrollerRef}
        className="scrollbar-none -mx-gutter flex snap-x snap-mandatory items-center gap-4 overflow-x-auto py-4 sm:gap-6"
      >
        {/* Spacers give the first and last slide room to center-snap. */}
        <li aria-hidden className="w-[calc(50%-min(36vw,170px))] shrink-0" />
        {entries.map((entry, index) => (
          <li
            key={entry.card.cardId}
            ref={el => {
              slideRefs.current[index] = el;
            }}
            className={cn(
              "w-[min(72vw,340px)] shrink-0 snap-center",
              "motion-safe:transition-[transform,opacity] motion-safe:duration-300",
              index === safeActiveIndex ? "scale-100 opacity-100" : "scale-90 opacity-50",
            )}
          >
            <button
              type="button"
              onClick={() => scrollToIndex(index)}
              className="block w-full cursor-pointer"
              aria-label={`Focus ${entry.card.name}`}
            >
              <Image
                src={entry.card.imageLarge ?? entry.card.imageSmall}
                alt={entry.card.name}
                width={490}
                height={684}
                sizes="(max-width: 640px) 72vw, 340px"
                className={cn(
                  "h-auto w-full rounded-field",
                  index === safeActiveIndex ? "shadow-float" : "shadow-card",
                )}
              />
            </button>
          </li>
        ))}
        <li aria-hidden className="w-[calc(50%-min(36vw,170px))] shrink-0" />
      </ul>

      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={safeActiveIndex === 0}
          onClick={() => scrollToIndex(safeActiveIndex - 1)}
          className="disabled:opacity-40"
          aria-label="Previous card"
          data-testid="carousel-prev"
        >
          ←
        </Button>
        <p className="tnum min-w-20 text-center text-sm text-foreground-subtle">
          {safeActiveIndex + 1} of {entries.length}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={safeActiveIndex === entries.length - 1}
          onClick={() => scrollToIndex(safeActiveIndex + 1)}
          className="disabled:opacity-40"
          aria-label="Next card"
          data-testid="carousel-next"
        >
          →
        </Button>
      </div>

      {active != null ? (
        <div
          className={cn(cardVariants(), "mx-auto flex w-full max-w-md flex-col gap-1 p-5 text-center")}
          data-testid="carousel-placard"
        >
          <p className="font-semibold text-foreground">{active.card.name}</p>
          <p className="text-sm text-foreground-subtle">
            {active.card.setName} · #{active.card.number}
            {active.card.rarity != null ? ` · ${active.card.rarity}` : ""}
          </p>
          <p className="text-sm text-foreground-subtle">
            {active.card.artist != null ? `Art by ${active.card.artist}` : "Artist unknown"}
          </p>
          {active.savedLabel != null ? (
            <p className="text-xs text-foreground-faint">{active.savedLabel}</p>
          ) : null}
          <Link
            href={`/card/${active.card.cardId}`}
            className="mx-auto mt-1 text-sm text-foreground-muted underline underline-offset-4 transition-colors hover:text-foreground"
          >
            View card
          </Link>
        </div>
      ) : null}
    </div>
  );
};

export default FocusCarousel;
