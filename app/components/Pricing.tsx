import Link from "next/link";

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
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
      <div className="mb-12 flex flex-col gap-3 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Simple Pricing</h2>
        <p className="mx-auto max-w-2xl text-zinc-600">
          Start free, forever. Upgrade when you want more results and unlimited collecting.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {TIERS.map(tier => (
          <div
            key={tier.name}
            className={`flex flex-col gap-6 rounded-2xl border p-8 ${
              tier.highlight
                ? "border-violet-300 bg-violet-50 shadow-md ring-1 ring-violet-200"
                : "border-zinc-200 bg-white shadow-sm"
            }`}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold text-zinc-900">{tier.name}</h3>
                {tier.highlight ? (
                  <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-medium text-white">
                    Most popular
                  </span>
                ) : null}
              </div>
              <p className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-zinc-900">{tier.price}</span>
                <span className="text-sm text-zinc-500">{tier.cadence}</span>
              </p>
            </div>

            <ul className="flex flex-col gap-3">
              {tier.features.map(feature => (
                <li key={feature} className="flex items-start gap-2 text-sm text-zinc-700">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                      tier.highlight ? "bg-violet-600 text-white" : "bg-zinc-900 text-white"
                    }`}
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
              className={`mt-auto rounded-full px-6 py-3 text-center font-semibold transition-colors ${
                tier.highlight
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90"
                  : "border border-zinc-300 text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Pricing;
