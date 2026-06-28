import Image from "next/image";
import type { Card } from "@/lib/pokemon";

interface HeroProps {
  // Best-effort showcase art. Empty when the API is unavailable; the hero then
  // renders text-only without breaking.
  showcase: Card[];
}

const Hero: React.FC<HeroProps> = ({ showcase }) => {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-b from-violet-50 via-white to-white">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
            Smart Trading Card Search
          </span>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
            Find Pokémon Cards by What&apos;s In the Art
          </h1>

          <p className="max-w-xl text-lg text-zinc-600">
            Describe a scene, a mood, or a color and search across 20,000+ Pokémon TCG
            illustrations. Remember the art, not the name? Start there.
          </p>

          <form action="/search" className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="search"
              name="q"
              placeholder="Try: surfing pikachu, on the beach, mewtwo…"
              aria-label="Search Pokémon cards"
              className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-zinc-900 shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Search Free
            </button>
          </form>

          <p className="text-sm text-zinc-400">No credit card required.</p>
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
                className="absolute top-1/2 left-1/2 w-28 -translate-y-1/2 rounded-xl shadow-xl ring-1 ring-black/5 transition-transform sm:w-32 lg:w-44"
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
                  alt={card.name}
                  width={245}
                  height={342}
                  className="h-auto w-full rounded-xl"
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
