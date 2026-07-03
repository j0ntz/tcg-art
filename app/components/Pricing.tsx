import Link from "next/link";
import SectionHeading from "./ui/SectionHeading";
import RevealSpring from "./motion/RevealSpring";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import { buttonVariants } from "./ui/Button";
import { cn } from "@/lib/utils";

// "Simple Pricing" — the exact freemium model captured from the clone target
// (docs/spec.md §9). Display-only in v1: no Stripe, no checkout.
interface Tier {
  name: string;
  price: string;
  cadence: string;
  highlight: boolean;
  cta: string;
  features: string[];
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    highlight: false,
    cta: "Start Searching",
    features: [
      "5 searches / day",
      "10 results per search",
      "10 favorites",
      "10 recent searches",
      "2 binder pages",
      "TCGplayer pricing",
    ],
  },
  {
    name: "Pro",
    price: "$3",
    cadence: "/mo · $30/yr · $60 lifetime",
    highlight: true,
    cta: "Go Pro",
    features: [
      "Unlimited searches",
      "100 results per search",
      "Unlimited favorites",
      "50 recent searches",
      "Unlimited binder pages",
      "Saved filter presets",
      "Priority support",
    ],
  },
];

const Pricing: React.FC = () => {
  return (
    <section className="mx-auto w-full max-w-content px-gutter py-16 sm:py-20">
      <RevealSpring>
        <SectionHeading
          className="mb-12"
          title="Simple Pricing"
          subtitle="Start free, forever. Upgrade when you want more results and unlimited collecting."
        />
      </RevealSpring>

      <div className="grid gap-6 md:grid-cols-2">
        {TIERS.map((tier, index) => (
          <RevealSpring key={tier.name} delay={index * 0.14} className="h-full">
            <Card
              variant={tier.highlight ? "highlight" : "default"}
              className="flex h-full flex-col gap-6 p-8"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-foreground">{tier.name}</h3>
                  {tier.highlight ? (
                    <Badge variant="solid" size="sm">
                      Most popular
                    </Badge>
                  ) : null}
                </div>
                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                  <span className="text-sm text-foreground-subtle">{tier.cadence}</span>
                </p>
              </div>

              <ul className="flex flex-col gap-3">
                {tier.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground-secondary">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-xs text-primary-foreground",
                        tier.highlight ? "bg-primary" : "bg-surface-inverse",
                      )}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={tier.highlight ? "/signup" : "/search"}
                className={cn(
                  buttonVariants({ variant: tier.highlight ? "gradient" : "secondary", size: "md" }),
                  "mt-auto",
                )}
              >
                {tier.cta}
              </Link>
            </Card>
          </RevealSpring>
        ))}
      </div>
    </section>
  );
};

export default Pricing;
