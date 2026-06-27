import SectionHeading from "./ui/SectionHeading";
import { cardVariants } from "./ui/Card";
import { cn } from "@/lib/utils";

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
    <section className="mx-auto w-full max-w-content px-gutter py-16 sm:py-20">
      <SectionHeading
        className="mb-12"
        title="How It Works"
        subtitle="Three steps from a vague memory of the art to the exact card."
      />

      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className={cn(cardVariants(), "flex flex-col gap-3 p-6")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-primary-subtle text-base font-bold text-primary-subtle-foreground">
              {index + 1}
            </span>
            <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm leading-relaxed text-foreground-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default HowItWorks;
