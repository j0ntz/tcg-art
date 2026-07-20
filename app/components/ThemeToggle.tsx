"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  THEME_CHOICES,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type ThemeChoice,
} from "@/lib/theme";

// Tri-state theme control in the header: System / Light / Dark.
//
// Clicking sets React state; an effect then writes the choice to the two places
// that actually drive the theme:
//   1. the `theme` cookie, so the SERVER stamps <html data-theme> on the next
//      navigation or reload and the first paint is already correct;
//   2. the live <html> attribute, so the CURRENT page re-themes immediately
//      without waiting for a round trip.
// Choosing "system" REMOVES the attribute rather than computing a value, which
// hands control back to `color-scheme: light dark` (globals.css). That is why
// system-theme changes track live with no matchMedia listener here.
//
// `initial` comes from the server-read cookie so the first client render agrees
// with the markup (no hydration mismatch, no post-hydration flicker).

interface ThemeToggleProps {
  initial: ThemeChoice;
}

// 14px line icons at currentColor. Line art, not emoji: emoji-as-icons is a
// banned pattern (docs/research/anti-slop-ui.md).
const ICONS: Record<ThemeChoice, React.ReactNode> = {
  system: (
    <>
      <rect x="2.5" y="3" width="11" height="8" rx="1.5" />
      <path d="M5.5 13.5h5" />
    </>
  ),
  light: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M5.4 10.6l-1 1M12.6 12.6l-1-1M5.4 5.4l-1-1" />
    </>
  ),
  dark: <path d="M13.2 9.4A5.6 5.6 0 0 1 6.6 2.8a5.6 5.6 0 1 0 6.6 6.6Z" />,
};

const LABELS: Record<ThemeChoice, string> = {
  system: "Match system theme",
  light: "Light theme",
  dark: "Dark theme",
};

const ThemeToggle: React.FC<ThemeToggleProps> = ({ initial }) => {
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  // The choice is applied OUTSIDE React's tree (a cookie plus an attribute on
  // <html>), which is exactly the external-system sync an effect is for.
  //
  // Skipped on mount: the server already rendered the correct attribute, and a
  // visitor who never touched the control must not be given a cookie for it.
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }

    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;

    const root = document.documentElement;
    // Suppress transitions for the flip itself (globals.css), so the whole page
    // repaints in the new theme at once instead of cross-fading every
    // `transition-colors` element through an unreadable in-between state. The
    // reflow read is required: it commits the suppression BEFORE the theme
    // change, otherwise both land in the same style recalc and the transitions
    // still run.
    root.dataset.themeSwitching = "";
    void root.offsetHeight;

    if (choice === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = choice;
    }

    // Two frames: one for the new theme to paint, one to release the freeze.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      delete root.dataset.themeSwitching;
    };
  }, [choice]);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-pill border border-border bg-surface-muted p-0.5"
      data-testid="theme-toggle"
    >
      {THEME_CHOICES.map(option => (
        <button
          key={option}
          type="button"
          aria-pressed={choice === option}
          aria-label={LABELS[option]}
          title={LABELS[option]}
          onClick={() => setChoice(option)}
          data-testid={`theme-${option}`}
          className={cn(
            // Tighter on mobile: the header nav has no room to spare at 390px.
            "rounded-pill p-1 transition-colors sm:p-1.5",
            choice === option
              ? "bg-surface text-foreground shadow-card"
              : "text-foreground-subtle hover:text-foreground",
          )}
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[option]}
          </svg>
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;
