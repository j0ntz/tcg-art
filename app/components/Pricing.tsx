import Link from "next/link";
import SectionHeading from "./ui/SectionHeading";
import Card from "./ui/Card";
import { buttonVariants } from "./ui/Button";
import { cn } from "@/lib/utils";

// "Simple Pricing" — the freemium model captured from the clone target
// (docs/spec.md §9). Display-only in v1: no Stripe, no checkout. The Pro tier's
// emphasis is a neutral lift plus the ember "Most popular" marker (one of the
// five budgeted accent placements, see globals.css).
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
      <SectionHeading
        className="mb-10"
        title="Simple pricing"
        subtitle="Start free, forever. Upgrade when you want more results and unlimited collecting."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {TIERS.map(tier => (
          <Card
            key={tier.name}
            variant={tier.highlight ? "highlight" : "default"}
            className="flex h-full flex-col gap-6 p-8"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <h3 className="font-display text-xl font-bold text-foreground">{tier.name}</h3>
                {tier.highlight ? (
                  <span className="text-sm font-semibold text-primary">Most popular</span>
                ) : null}
              </div>
              <p className="flex items-baseline gap-1">
                <span className="tnum font-display text-4xl font-extrabold text-foreground">
                  {tier.price}
                </span>
                <span className="tnum text-sm text-foreground-subtle">{tier.cadence}</span>
              </p>
            </div>

            <ul className="flex flex-col divide-y divide-border">
              {tier.features.map(feature => (
                <li key={feature} className="py-2.5 text-sm text-foreground-secondary">
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href={tier.highlight ? "/signup" : "/search"}
              className={cn(
                buttonVariants({ variant: tier.highlight ? "accent" : "secondary", size: "md" }),
                "mt-auto",
              )}
            >
              {tier.cta}
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default Pricing;
