"use client";

import Image from "next/image";
import { useRef } from "react";
import { m, useScroll, useTransform, type MotionValue } from "motion/react";
import type { Card } from "@/lib/pokemon";
import Button from "./ui/Button";

interface HeroProps {
  // Best-effort showcase art. Empty when the API is unavailable; the hero then
  // renders text-only without breaking.
  showcase: Card[];
}

interface FanCardProps {
  card: Card;
  index: number;
  // Hero scroll progress: 0 with the hero fully in view, 1 once scrolled past.
  progress: MotionValue<number>;
}

// One card in the fan. Three layers so the transforms compose instead of
// fighting: a static slot div owns the fan geometry (CSS-var transform, same
// breakpoint-driven math as the pre-rework hero), an outer m.div scrubs the
// scroll parallax (the fan spreads apart and lifts as the page scrolls), and
// an inner m.div plays the spring "dealt into your hand" entrance + hover.
const FanCard: React.FC<FanCardProps> = ({ card, index, progress }) => {
  const signed = index - 2;
  const magnitude = Math.abs(signed);
  const x = useTransform(progress, [0, 1], [0, signed * 30]);
  const y = useTransform(progress, [0, 1], [0, -(24 + magnitude * 22)]);
  const rotate = useTransform(progress, [0, 1], [0, signed * 3]);

  return (
    <div
      className="absolute top-1/2 left-1/2 w-28 -translate-y-1/2 sm:w-32 lg:w-40"
      style={
        {
          "--i": signed,
          "--ai": magnitude,
          transform:
            "translate(-50%, -50%) translateX(calc(var(--i) * var(--fan-spread))) translateY(calc(var(--ai) * var(--fan-lift))) rotate(calc(var(--i) * var(--fan-angle)))",
          zIndex: 10 - magnitude,
        } as React.CSSProperties
      }
    >
      <m.div style={{ x, y, rotate }}>
        <m.div
          className="rounded-xl shadow-float ring-1 ring-black/5"
          initial={{ opacity: 0, y: 72, rotate: signed * -8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 70, damping: 14, delay: 0.2 + magnitude * 0.12 }}
          whileHover={{ scale: 1.06, y: -10 }}
        >
          <Image
            src={card.images.small}
            alt={card.name}
            width={245}
            height={342}
            className="h-auto w-full rounded-xl"
            priority={index === 2}
          />
        </m.div>
      </m.div>
    </div>
  );
};

// Kinetic gallery hero: centered editorial layout with the fan spanning below
// the search bar like cards laid out on a table. All motion runs through the
// `motion` library (springs + scroll scrubbing) under MotionProvider.
const Hero: React.FC<HeroProps> = ({ showcase }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden border-b border-border bg-surface-muted"
    >
      <div className="mx-auto flex w-full max-w-content flex-col items-center gap-6 px-gutter pt-16 text-center sm:pt-24">
        <m.div
          className="flex flex-col items-center gap-6"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 16 }}
        >
          <span className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
            Smart Trading Card Search
          </span>

          <h1 className="max-w-3xl text-title font-bold leading-tight tracking-tight text-foreground sm:text-display">
            Find Pokémon Cards by{" "}
            <span className="bg-brand-gradient bg-clip-text text-transparent">
              What&apos;s In the Art
            </span>
          </h1>

          <p className="max-w-xl text-lead text-foreground-muted">
            Describe a scene, a mood, or a color and search across 20,000+ Pokémon TCG
            illustrations. Remember the art, not the name? Start there.
          </p>

          <form
            action="/search"
            className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
          >
            <input
              type="search"
              name="q"
              placeholder="Try: surfing pikachu, on the beach, mewtwo…"
              aria-label="Search Pokémon cards"
              className="flex-1 rounded-pill border border-border-strong bg-surface px-5 py-3 text-foreground shadow-card outline-none focus:border-ring focus:ring-2 focus:ring-primary-border"
            />
            <Button type="submit" variant="gradient" size="lg" className="shadow-card">
              Search Free
            </Button>
          </form>

          <p className="text-sm text-foreground-faint">No credit card required.</p>
        </m.div>
      </div>

      {showcase.length > 0 ? (
        // Fan geometry via CSS custom properties, as before the rework: the
        // mobile spread keeps all 5 cards inside a ~360px column with no
        // horizontal overflow; wider breakpoints open the fan up. The section
        // is overflow-hidden so the scroll-scrub spread cannot widen the page.
        <div
          className="relative mx-auto h-[240px] w-full max-w-3xl [--fan-angle:6deg] [--fan-lift:14px] [--fan-spread:46px] sm:h-[280px] sm:[--fan-spread:64px] lg:h-[320px] lg:[--fan-angle:8deg] lg:[--fan-spread:110px]"
          aria-hidden="true"
        >
          {showcase.slice(0, 5).map((card, index) => (
            <FanCard key={card.id} card={card} index={index} progress={scrollYProgress} />
          ))}
        </div>
      ) : (
        <div className="pb-16 sm:pb-24" />
      )}
    </section>
  );
};

export default Hero;
