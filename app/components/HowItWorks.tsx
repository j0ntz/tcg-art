import SectionHeading from "./ui/SectionHeading";
import RevealSpring from "./motion/RevealSpring";
import { cardVariants } from "./ui/Card";
import { cn } from "@/lib/utils";

// Mirrors the clone target's 3-step "How It Works" content, restyled for the
// kinetic gallery option: oversized ghost step numbers behind each card, the
// cards springing up with a stagger as they scroll into view.
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
      <RevealSpring>
        <SectionHeading
          className="mb-12"
          title="How It Works"
          subtitle="Three steps from a vague memory of the art to the exact card."
        />
      </RevealSpring>

      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <RevealSpring delay={index * 0.12} className="h-full">
              <div className={cn(cardVariants(), "relative h-full overflow-hidden p-6")}>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-4 right-2 text-8xl font-bold text-primary-subtle select-none"
                >
                  {index + 1}
                </span>
                <div className="relative flex flex-col gap-2 pt-8">
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-foreground-muted">{step.body}</p>
                </div>
              </div>
            </RevealSpring>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default HowItWorks;
