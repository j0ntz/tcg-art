// The theme choice contract, shared by the server (app/layout.tsx reads the
// cookie and stamps <html data-theme>) and the client (ThemeToggle writes it).
//
// Three choices, one standard tri-state: "system" is the DEFAULT and is
// represented by the ABSENCE of the data-theme attribute, which lets
// `color-scheme: light dark` in globals.css resolve prefers-color-scheme
// natively. That is what makes system-theme changes re-render the page with no
// JS listener, and what keeps the no-JS experience correct.

export const THEME_COOKIE = "theme";

// One year; the choice is a preference, not a session.
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export const isThemeChoice = (value: string | undefined): value is ThemeChoice =>
  value === "system" || value === "light" || value === "dark";

// The value for <html data-theme>. `undefined` omits the attribute entirely,
// which is the "follow the system" state.
export const themeAttribute = (choice: ThemeChoice): "light" | "dark" | undefined =>
  choice === "system" ? undefined : choice;
