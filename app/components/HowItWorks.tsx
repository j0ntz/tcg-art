import SectionHeading from "./ui/SectionHeading";
import Reveal from "./motion/Reveal";

// Mirrors the clone target's 3-step "How It Works" content, restyled as a
// vertical timeline: a connecting line with gradient number stops, each step
// sliding in from the left as it scrolls into view.
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
    // overflow-x-clip: the from-left pre-reveal offset (globals.css) must not
    // widen the page on mobile before the steps reveal.
    <section className="mx-auto w-full max-w-content overflow-x-clip px-gutter py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          className="mb-12"
          title="How It Works"
          subtitle="Three steps from a vague memory of the art to the exact card."
        />
      </Reveal>

      <ol className="relative mx-auto flex w-full max-w-2xl flex-col gap-10 before:absolute before:top-2 before:bottom-2 before:left-5 before:w-px before:bg-primary-border before:content-['']">
        {STEPS.map((step, index) => (
          <Reveal
            key={step.title}
            as="li"
            from="left"
            delayMs={index * 120}
            className="relative grid grid-cols-[2.5rem_1fr] gap-x-5"
          >
            <span className="z-10 flex h-10 w-10 items-center justify-center rounded-pill bg-brand-gradient text-base font-bold text-primary-foreground shadow-card">
              {index + 1}
            </span>
            <div className="pt-1.5">
              <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
};

export default HowItWorks;
