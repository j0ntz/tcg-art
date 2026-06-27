// Mirrors the clone target's 3-step "How It Works" section (see the scrape in
// docs / ~/pokemon-artfinder-scrape-and-spec.md).
const STEPS = [
  {
    title: "Tell Us What You See",
    body: "Describe the card from memory: a Pikachu surfing on a wave, a fiery Charizard, a quiet forest scene.",
  },
  {
    title: "We Do the Heavy Lifting",
    body: "Your description is compared against thousands of artworks to surface the cards that match what you pictured.",
  },
  {
    title: "Uncover Hidden Gems",
    body: "Browse the matches and discover alt-arts and illustrations you didn't even know existed.",
  },
] as const;

const HowItWorks: React.FC = () => {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
      <div className="mb-12 flex flex-col gap-3 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">How It Works</h2>
        <p className="mx-auto max-w-2xl text-zinc-600">
          Three steps from a vague memory of the art to the exact card.
        </p>
      </div>

      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-base font-bold text-violet-700">
              {index + 1}
            </span>
            <h3 className="text-lg font-semibold text-zinc-900">{step.title}</h3>
            <p className="text-sm leading-relaxed text-zinc-600">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default HowItWorks;
