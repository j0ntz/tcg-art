"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import BinderPages from "./BinderPages";
import Carousel from "./Carousel";
import NightGallery from "./NightGallery";
import { DISPLAY_MODES, type BinderEntry, type DisplayMode } from "./types";

interface BinderViewProps {
  entries: BinderEntry[];
  initialMode: DisplayMode;
}

const MODE_LABELS: Record<DisplayMode, string> = {
  binder: "Binder",
  carousel: "Carousel",
  gallery: "Night Gallery",
};

// The three-way display-mode switcher. Mode is client state seeded from the
// server-read ?mode= param; switching also rewrites the query string (shallow,
// no navigation) so a mode can be linked to and survives reload.
const BinderView: React.FC<BinderViewProps> = ({ entries, initialMode }) => {
  const [mode, setMode] = useState<DisplayMode>(initialMode);

  const selectMode = (next: DisplayMode): void => {
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <section className="flex flex-col gap-6">
      <div
        role="group"
        aria-label="Display mode"
        className="flex w-fit items-center gap-1 rounded-pill border border-border bg-surface-muted p-1"
      >
        {DISPLAY_MODES.map(candidate => (
          <button
            key={candidate}
            type="button"
            aria-pressed={mode === candidate}
            data-testid={`mode-${candidate}`}
            onClick={() => selectMode(candidate)}
            className={cn(
              "rounded-pill px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
              mode === candidate
                ? "bg-surface-inverse text-primary-foreground shadow-card"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {MODE_LABELS[candidate]}
          </button>
        ))}
      </div>

      {mode === "binder" ? <BinderPages entries={entries} /> : null}
      {mode === "carousel" ? <Carousel entries={entries} /> : null}
      {mode === "gallery" ? <NightGallery entries={entries} /> : null}
    </section>
  );
};

export default BinderView;
