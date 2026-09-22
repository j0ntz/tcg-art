import SectionHeading from "./ui/SectionHeading";

// "Saves & decks" feature pitch: the logged-in experience in three rows. Same
// editorial ledger primitive as How It Works: split heading + hairline-divided
// feature rows on the muted surface. No gradient band, no glass cards.
const FEATURES = [
  {
    title: "One-tap saves",
    body: "Heart any card from search or its detail page and it lands in your saves instantly.",
  },
  {
    title: "Decks for every idea",
    body: "Group cards into named decks: a deck concept, an artist study, a gift list. A card can live in any number of them.",
  },
  {
    title: "Filters that know the art",
    body: "Slice your cards by type, rarity, set, or artist, and by what the art shows: its dominant color and mood.",
  },
] as const;

const SavesAndDecks: React.FC = () => {
  return (
    <section className="border-y border-border bg-surface-muted">
      <div className="mx-auto grid w-full max-w-content gap-10 px-gutter py-16 sm:py-20 lg:grid-cols-2 lg:items-start">
        <SectionHeading
          title="Save it, deck it"
          subtitle="Collecting is half the fun. Keep the cards you love one tap away and organize them into decks you can slice any way you remember them."
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

export default SavesAndDecks;
