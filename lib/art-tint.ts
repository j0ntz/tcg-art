// The ART-TINT channel (docs/design-system.md): per-card accents derived from
// the card's own indexed palette words (or its energy type as a fallback), so
// the artwork, not the brand, supplies the color. This is deliberately outside
// the ember accent budget, and it is allowed in exactly two shapes:
//   wash — a whisper-chroma fill behind detail-page art
//   ring — a mid-chroma hover ring on result cards
// Both are fixed OKLCH recipes over a single hue; components receive them as
// CSS custom properties and never mix their own colors.

// Palette words come from the Haiku art indexer (free-form lowercase color
// words) and from type hints; map the common vocabulary to an OKLCH hue.
const WORD_HUES: Record<string, number> = {
  red: 25,
  crimson: 25,
  scarlet: 27,
  orange: 45,
  flame: 40,
  fire: 40,
  amber: 70,
  gold: 85,
  golden: 85,
  yellow: 95,
  cream: 90,
  green: 145,
  forest: 140,
  emerald: 155,
  teal: 190,
  cyan: 200,
  aqua: 205,
  turquoise: 195,
  blue: 250,
  navy: 260,
  indigo: 275,
  purple: 300,
  violet: 295,
  lavender: 290,
  magenta: 330,
  pink: 350,
  rose: 10,
  brown: 55,
  tan: 70,
  beige: 80,
};

// Energy types carry a conventional color even when no palette word maps.
const TYPE_HUES: Record<string, number> = {
  Fire: 40,
  Water: 240,
  Lightning: 95,
  Grass: 145,
  Psychic: 300,
  Fighting: 55,
  Darkness: 280,
  Metal: 250,
  Fairy: 350,
  Dragon: 85,
};

export interface ArtTint {
  /** Whisper-chroma fill for the wash behind detail art. */
  wash: string;
  /** Mid-chroma color for the hover ring on result cards. */
  ring: string;
}

const tintFromHue = (hue: number): ArtTint => ({
  wash: `oklch(96.5% 0.03 ${hue})`,
  ring: `oklch(70% 0.13 ${hue})`,
});

/**
 * Derive a card's tint from its indexed palette words, falling back to its
 * energy type. Achromatic words (black, white, gray, silver) and unknown
 * words yield no tint; the card then keeps the neutral chrome.
 */
export const artTint = (palette: readonly string[], types: readonly string[]): ArtTint | null => {
  for (const word of palette) {
    const hue = WORD_HUES[word];
    if (hue != null) return tintFromHue(hue);
  }
  for (const type of types) {
    const hue = TYPE_HUES[type];
    if (hue != null) return tintFromHue(hue);
  }
  return null;
};
