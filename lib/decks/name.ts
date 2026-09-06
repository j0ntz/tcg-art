// Deck-name rules, in their own module so client components (the add-to-deck
// menu's create form) can import them without pulling the DB driver graph in
// lib/decks/index.ts into the browser bundle.

export const DECK_NAME_MAX = 60;

// Normalizes user input for a deck name; null means "reject the submit".
export const sanitizeDeckName = (value: FormDataEntryValue | null): string | null => {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, DECK_NAME_MAX);
  return name.length > 0 ? name : null;
};
