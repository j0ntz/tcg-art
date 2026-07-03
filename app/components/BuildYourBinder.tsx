import SectionHeading from "./ui/SectionHeading";
import Reveal from "./motion/Reveal";

// "Build Your Binder" section, matching the clone target's feature pitch:
// drag-and-drop grids, themes, and shareable links. These are roadmap features
// (v3 in docs/spec.md), so this section is a display-only marketing tease.
const FEATURES = [
  {
    title: "Drag-and-drop pages",
    body: "Arrange your favorite cards into beautiful binder layouts, just like a physical page.",
  },
  {
    title: "18+ themes",
    body: "Pokéball patterns, ocean gradients, solid colors, and card-sleeve looks to set the mood.",
  },
  {
    title: "Shareable links",
    body: "Generate a link to any binder page and share your collection with friends.",
  },
] as const;

const BuildYourBinder: React.FC = () => {
  return (
    // overflow-x-clip: the left/right pre-reveal offsets (globals.css) would
    // otherwise widen the page horizontally on mobile before the items reveal.
    <section className="overflow-x-clip border-y border-border bg-gradient-to-br from-accent to-primary-hover">
      <div className="mx-auto grid w-full max-w-content gap-10 px-gutter py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
        <Reveal from="left">
          <SectionHeading
            align="left"
            tone="inverse"
            title="Build Your Binder"
            subtitle="Collecting is half the fun. Save the cards you love and organize them into custom binder pages you can show off."
          />
        </Reveal>

        <ul className="grid gap-4">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} as="li" from="right" delayMs={index * 120}>
              <div className="rounded-panel bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
                <h3 className="font-semibold text-foreground-inverse">{feature.title}</h3>
                <p className="mt-1 text-sm text-primary-foreground-muted">{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default BuildYourBinder;
