import Image from "next/image";
import Link from "next/link";

import type { BinderEntry } from "./types";

interface NightGalleryProps {
  entries: BinderEntry[];
}

// Mode 3, "The Night Gallery": the collection hung as a museum exhibition on a
// flat near-black wall. Each piece gets an ink frame with a white mat and a
// placard crediting the artist, which is the one thing the binder grid and the
// carousel never foreground. Decoration is material (frame, mat, shadow), not
// lighting effects; the only motion is a motion-safe hover lift.
const NightGallery: React.FC<NightGalleryProps> = ({ entries }) => (
  <section
    className="rounded-panel bg-surface-night px-5 pb-14 pt-10 sm:px-10"
    data-testid="night-gallery"
    data-stage="night"
  >
    <header className="mb-10 flex flex-col gap-1">
      <p className="font-display text-lg font-bold text-foreground-inverse">
        The Night Gallery
      </p>
      <p className="text-sm text-foreground-inverse-subtle">
        Your collection, hung and lit. Open late.
      </p>
    </header>

    <ul className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(entry => (
        <li key={entry.card.id} className="flex flex-col items-center">
          <figure className="flex w-full max-w-[300px] flex-col items-center">
            <Link
              href={`/card/${entry.card.id}`}
              className="block w-full rounded-field bg-surface-night-frame p-1 shadow-float transition-transform motion-safe:hover:-translate-y-1"
            >
              {/* White mat between frame and art, like a real print. */}
              <span className="block rounded-[4px] bg-surface-mat p-2">
                <Image
                  src={entry.card.images.large}
                  alt={entry.card.name}
                  width={490}
                  height={684}
                  sizes="(max-width: 640px) 90vw, 300px"
                  className="h-auto w-full rounded-[2px]"
                />
              </span>
            </Link>
            <figcaption className="mt-4 w-fit max-w-full rounded-field bg-surface-mat px-4 py-2.5 text-left shadow-card">
              <p className="text-sm text-foreground-on-mat">
                <span className="font-display font-semibold">{entry.card.name}</span>
                <span className="text-foreground-on-mat-subtle">, {entry.card.set.name}</span>
              </p>
              <p className="mt-0.5 text-xs text-foreground-on-mat-subtle">
                {entry.card.artist != null ? `Art by ${entry.card.artist}` : "Artist unknown"}
                {entry.card.rarity != null ? ` · ${entry.card.rarity}` : ""}
              </p>
              <p className="tnum mt-0.5 text-xs text-foreground-on-mat-faint">
                Added {entry.acquiredLabel}
                {entry.quantity > 1 ? ` · ×${entry.quantity}` : ""}
              </p>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  </section>
);

export default NightGallery;
