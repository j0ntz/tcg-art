import Image from "next/image";

import type { BinderEntry } from "./types";

interface NightGalleryProps {
  entries: BinderEntry[];
}

// Mode 3, "The Night Gallery" (the winning /drunk-claude idea): the collection
// hung as a museum exhibition. Dark wall, a pooled spotlight per piece, a
// brand-gradient frame with a white mat, and a placard crediting the artist,
// which is the one thing the binder grid and the carousel never foreground.
// Everything decorative is static CSS (gradients, shadows), so mobile and
// prefers-reduced-motion get the full effect; the only motion is a
// motion-safe hover lift. The white/amber alphas are decorative lighting
// one-offs on the dark wall, not new palette roles.
const NightGallery: React.FC<NightGalleryProps> = ({ entries }) => (
  <section
    className="relative overflow-hidden rounded-panel bg-surface-inverse px-5 pb-14 pt-10 sm:px-10"
    data-testid="night-gallery"
  >
    {/* Ambient house light along the ceiling. */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10),transparent_70%)]"
    />

    <header className="relative mb-10 flex flex-col items-center gap-2 text-center">
      <p className="text-xs uppercase tracking-[0.35em] text-primary-foreground-muted">
        The Night Gallery
      </p>
      <p className="text-sm text-foreground-inverse/60">
        Your collection, hung and lit. Open late.
      </p>
    </header>

    <ul className="relative grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(entry => (
        <li key={entry.card.id} className="flex flex-col items-center">
          <figure
            className={
              "flex w-full max-w-[300px] flex-col items-center " +
              "bg-[radial-gradient(ellipse_at_top,rgba(255,236,179,0.13),transparent_65%)] px-4 pb-2 pt-6"
            }
          >
            <a
              href={entry.card.images.large}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-[6px] bg-brand-gradient p-1 shadow-float transition-transform motion-safe:hover:-translate-y-1"
            >
              {/* White mat between frame and art, like a real print. */}
              <span className="block rounded-[4px] bg-surface p-2">
                <Image
                  src={entry.card.images.large}
                  alt={entry.card.name}
                  width={490}
                  height={684}
                  sizes="(max-width: 640px) 90vw, 300px"
                  className="h-auto w-full rounded-[2px]"
                />
              </span>
            </a>
            <figcaption className="mt-5 w-fit max-w-full rounded-field bg-surface px-4 py-2.5 text-left shadow-card">
              <p className="text-sm text-foreground">
                <span className="font-medium italic">{entry.card.name}</span>
                <span className="text-foreground-subtle">, {entry.card.set.name}</span>
              </p>
              <p className="mt-0.5 text-xs text-foreground-subtle">
                {entry.card.artist != null ? `Illus. ${entry.card.artist}` : "Artist unknown"}
                {entry.card.rarity != null ? ` · ${entry.card.rarity}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-foreground-faint">
                Acquired {entry.acquiredLabel}
                {entry.quantity > 1 ? ` · edition of ${entry.quantity}` : ""}
              </p>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  </section>
);

export default NightGallery;
