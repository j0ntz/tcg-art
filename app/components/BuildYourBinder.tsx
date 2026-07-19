import SectionHeading from "./ui/SectionHeading";

// "Build Your Binder" feature pitch (roadmap features, v3 in docs/spec.md; this
// section is a display-only marketing tease). Same editorial ledger primitive
// as How It Works: split heading + hairline-divided feature rows on the muted
// surface. No gradient band, no glass cards.
const FEATURES = [
  {
    title: "Drag-and-drop pages",
    body: "Arrange your favorite cards into beautiful binder layouts, just like a physical page.",
  },
  {
    title: "18+ themes",
    body: "Pokéball patterns, ocean tones, solid colors, and card-sleeve looks to set the mood.",
  },
  {
    title: "Shareable links",
    body: "Generate a link to any binder page and share your collection with friends.",
  },
] as const;

const BuildYourBinder: React.FC = () => {
  return (
    <section className="border-y border-border bg-surface-muted">
      <div className="mx-auto grid w-full max-w-content gap-10 px-gutter py-16 sm:py-20 lg:grid-cols-2 lg:items-start">
        <SectionHeading
          title="Build your binder"
          subtitle="Collecting is half the fun. Save the cards you love and organize them into custom binder pages you can show off."
        />

        <ul className="border-t border-border">
          {FEATURES.map(feature => (
            <li key={feature.title} className="border-b border-border py-5">
              <h3 className="font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1 text-sm text-foreground-muted">{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default BuildYourBinder;
