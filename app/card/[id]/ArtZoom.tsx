"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface ArtZoomProps {
  name: string;
  imageLarge: string;
}

// Click-to-zoom for the card detail art: the card opens as a full-screen
// lightbox at the API's highest resolution. Closes on backdrop click, the
// close button, or Escape; body scroll is locked while open.
const ArtZoom: React.FC<ArtZoomProps> = ({ name, imageLarge }) => {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full cursor-zoom-in"
        aria-label={`Zoom into the art of ${name}`}
        data-testid="art-zoom-open"
      >
        <Image
          src={imageLarge}
          alt={`${name} card art`}
          width={734}
          height={1024}
          priority
          sizes="(max-width: 640px) 90vw, 420px"
          className="h-auto w-full rounded-field shadow-float transition-transform motion-safe:group-hover:-translate-y-1"
        />
        <span className="mt-3 block text-center text-xs text-foreground-subtle">
          Click to zoom
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} art, zoomed`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-night/95 p-4"
          onClick={() => setOpen(false)}
          data-testid="art-zoom-overlay"
          data-stage="night"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close zoom"
            className="absolute right-4 top-4 rounded-pill border border-border-inverse px-4 py-2 text-sm font-medium text-foreground-inverse transition-colors hover:bg-surface-night-fill"
          >
            Close ✕
          </button>
          <Image
            src={imageLarge}
            alt={`${name} card art, full resolution`}
            width={734}
            height={1024}
            sizes="100vw"
            className="h-[min(92vh,64rem)] w-auto max-w-[94vw] rounded-field object-contain"
            onClick={event => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
};

export default ArtZoom;
