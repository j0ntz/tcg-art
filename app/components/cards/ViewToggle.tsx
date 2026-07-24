import Link from "next/link";

import type { FacetSearchParams } from "@/lib/facets";
import { cn } from "@/lib/utils";

type ViewKey = "grid" | "carousel";

interface ViewToggleProps {
  view: ViewKey;
  // The surface's current search params, so switching views preserves the
  // applied filters/sort. Plain links: view is URL state, no client JS needed.
  params: FacetSearchParams;
}

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: "grid", label: "Grid" },
  { key: "carousel", label: "Carousel" },
];

const hrefFor = (view: ViewKey, params: FacetSearchParams): string => {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "view" || value == null) continue;
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one);
  }
  if (view !== "grid") next.set("view", view);
  const qs = next.toString();
  return qs.length > 0 ? `?${qs}` : "?";
};

const ViewToggle: React.FC<ViewToggleProps> = ({ view, params }) => (
  <nav
    aria-label="View"
    className="flex w-fit items-center gap-1 rounded-pill border border-border bg-surface-muted p-1"
  >
    {VIEWS.map(candidate => (
      <Link
        key={candidate.key}
        href={hrefFor(candidate.key, params)}
        aria-current={view === candidate.key ? "page" : undefined}
        data-testid={`view-${candidate.key}`}
        className={cn(
          "rounded-pill px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
          view === candidate.key
            ? "bg-surface-inverse text-primary-foreground shadow-card"
            : "text-foreground-muted hover:text-foreground",
        )}
      >
        {candidate.label}
      </Link>
    ))}
  </nav>
);

export default ViewToggle;
