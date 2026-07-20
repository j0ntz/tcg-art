import Image from "next/image";
import type { Card } from "@/lib/pokemon";
import Button from "./ui/Button";

interface HeroProps {
  // Best-effort showcase art. Empty when the API is unavailable; the hero then
  // renders text-only without breaking.
  showcase: Card[];
}

// Midnight cinema hero: a flat near-black stage where the card art is the only
// color. No glows, no gradients, no badge above the H1; the ember accent is
// spent on the headline emphasis and the CTA (two of the five budgeted
// placements, see globals.css).
const Hero: React.FC<HeroProps> = ({ showcase }) => {
  return (
    <section className="relative overflow-hidden bg-surface-night" data-stage="night">
      <div className="relative mx-auto grid w-full max-w-content gap-12 px-gutter py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-6">
          <h1 className="font-display text-title font-extrabold tracking-tight text-foreground-inverse sm:text-display">
            Find Pokémon cards by{" "}
            <em className="font-light not-italic text-primary-bright">what&apos;s in the art</em>
          </h1>

          <p className="max-w-xl text-lead text-foreground-inverse-muted">
            Describe a scene, a mood, or a color and search across 20,000+ Pokémon TCG
            illustrations. Remember the art, not the name? Start there.
          </p>

          <form action="/search" className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="search"
              name="q"
              placeholder="Try: surfing pikachu, on the beach, mewtwo…"
              aria-label="Search Pokémon cards"
              className="flex-1 rounded-pill border border-border-inverse bg-surface-night-fill px-5 py-3 text-foreground-inverse placeholder:text-foreground-inverse-subtle focus:border-border-inverse"
            />
            <Button type="submit" variant="accent" size="lg">
              Search Free
            </Button>
          </form>

          <p className="text-sm text-foreground-inverse-subtle">No credit card required.</p>
        </div>

        {showcase.length > 0 ? (
          // Fan geometry is driven by CSS custom properties so the breakpoint can
          // swap the spread/lift/card-size between a tight mobile fan and the wide
          // lg layout, while each card keeps its per-index transform math. The
          // mobile spread (44px) keeps all 5 cards inside a ~360px column with no
          // horizontal overflow; lg restores the original wide fan unchanged.
          <div
            className="relative h-[300px] w-full [--fan-angle:6deg] [--fan-lift:12px] [--fan-spread:44px] sm:h-[360px] sm:[--fan-spread:56px] lg:h-[420px] lg:[--fan-angle:7deg] lg:[--fan-lift:22px] lg:[--fan-spread:96px]"
            aria-hidden="true"
          >
            {showcase.slice(0, 5).map((card, index) => (
              <div
                key={card.id}
                // hero-fan-card adds the scroll-linked fan opening (globals.css);
                // it animates `translate`, which composes with this transform.
                className="hero-fan-card absolute top-1/2 left-1/2 w-28 -translate-y-1/2 rounded-field shadow-float ring-1 ring-border-inverse sm:w-32 lg:w-44"
                style={
                  {
                    "--i": index - 2,
                    "--ai": Math.abs(index - 2),
                    transform:
                      "translate(-50%, -50%) translateX(calc(var(--i) * var(--fan-spread))) translateY(calc(var(--ai) * var(--fan-lift))) rotate(calc(var(--i) * var(--fan-angle)))",
                    zIndex: 10 - Math.abs(index - 2),
                  } as React.CSSProperties
                }
              >
                <Image
                  src={card.images.small}
                  alt=""
                  width={245}
                  height={342}
                  className="h-auto w-full rounded-field"
                  priority={index === 2}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default Hero;
