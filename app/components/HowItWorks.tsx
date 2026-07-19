import SectionHeading from "./ui/SectionHeading";

// Three steps from a vague memory to the exact card, set as an editorial
// ledger: hairline-divided rows, step number as quiet tabular text, content
// left-aligned. No timelines, no numbered medallions, no per-item reveals.
const STEPS = [
  {
    title: "Tell us what you see",
    body: "Describe the card from memory: a Pikachu surfing on a wave, a fiery Charizard, a quiet forest scene.",
  },
  {
    title: "We do the heavy lifting",
    body: "Your description is compared against thousands of artworks to surface the cards that match what you pictured.",
  },
  {
    title: "Uncover hidden gems",
    body: "Browse the matches and discover alt-arts and illustrations you didn't even know existed.",
  },
] as const;

const HowItWorks: React.FC = () => {
  return (
    <section className="mx-auto w-full max-w-content px-gutter py-16 sm:py-20">
      <SectionHeading
        className="mb-10"
        title="How it works"
        subtitle="Three steps from a vague memory of the art to the exact card."
      />

      <ol className="border-t border-border">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[3rem_1fr] gap-x-4 border-b border-border py-6 sm:grid-cols-[5rem_1fr] sm:gap-x-8"
          >
            <span className="tnum pt-0.5 text-sm text-foreground-faint">{index + 1}</span>
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default HowItWorks;
