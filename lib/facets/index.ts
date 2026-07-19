// The single source of truth for faceted filtering and sorting: every facet
// group and sort order the site offers is data in this module, so adding one
// later is a config edit, not new plumbing. Consumed by /search, /saves, and
// /decks/[id].
//
// Semantics follow the established faceted-search conventions: multi-select
// is OR within a group, AND across groups; each option shows the count of
// results it would yield given every OTHER group's current selection; filter
// and sort state is URL-encoded (shareable, back-button-safe).

import type { ArtIndexEntry } from "@/lib/art-search";
import type { Card } from "@/lib/pokemon";

// ---------- The card shape facets operate on ----------

// Normalized from either source: an art-index entry (which adds the vision
// attributes) or a Pokemon TCG API card (game metadata only).
export interface FacetCard {
  cardId: string;
  name: string;
  setId: string;
  setName: string;
  number: string;
  rarity: string | null;
  artist: string | null;
  imageSmall: string;
  imageLarge: string | null;
  supertype: string | null;
  subtypes: string[];
  types: string[];
  nationalPokedexNumbers: number[];
  releaseDate: string | null;
  // Vision attributes (empty for cards outside the art index).
  palette: string[];
  mood: string[];
}

export const facetCardFromIndexEntry = (entry: ArtIndexEntry): FacetCard => ({
  cardId: entry.cardId,
  name: entry.name,
  setId: entry.setId,
  setName: entry.setName,
  number: entry.number,
  rarity: entry.rarity,
  artist: entry.artist,
  imageSmall: entry.imageSmall,
  imageLarge: entry.imageLarge,
  supertype: entry.supertype ?? null,
  subtypes: entry.subtypes ?? [],
  types: entry.types ?? [],
  nationalPokedexNumbers: entry.nationalPokedexNumbers ?? [],
  releaseDate: entry.releaseDate ?? null,
  palette: entry.palette,
  mood: entry.mood,
});

export const facetCardFromApiCard = (card: Card): FacetCard => ({
  cardId: card.id,
  name: card.name,
  setId: card.set.id,
  setName: card.set.name,
  number: card.number,
  rarity: card.rarity,
  artist: card.artist,
  imageSmall: card.images.small,
  imageLarge: card.images.large,
  supertype: card.supertype,
  subtypes: card.subtypes,
  types: card.types,
  nationalPokedexNumbers: card.nationalPokedexNumbers,
  releaseDate: card.releaseDate,
  palette: [],
  mood: [],
});

// ---------- Color canonicalization (vision palette -> facet + hue) ----------

// Canonical color buckets in hue-wheel order; the number is the sort hue.
// Non-spectral colors sit after the wheel so a hue sort reads as a rainbow
// ending in earth tones and neutrals.
const COLOR_HUES: Record<string, number> = {
  red: 0,
  orange: 30,
  yellow: 55,
  green: 120,
  teal: 170,
  blue: 230,
  purple: 280,
  pink: 330,
  brown: 380,
  white: 400,
  gray: 410,
  black: 420,
};

// Palette words the vision pass emits mapped into canonical buckets. A
// multi-word entry ("dark blue") falls back to its last word.
const COLOR_ALIASES: Record<string, string> = {
  crimson: "red",
  scarlet: "red",
  maroon: "red",
  gold: "yellow",
  golden: "yellow",
  cream: "yellow",
  beige: "brown",
  tan: "brown",
  amber: "orange",
  peach: "orange",
  emerald: "green",
  lime: "green",
  olive: "green",
  turquoise: "teal",
  cyan: "teal",
  aqua: "teal",
  navy: "blue",
  indigo: "purple",
  violet: "purple",
  lavender: "purple",
  magenta: "pink",
  silver: "gray",
  grey: "gray",
  charcoal: "gray",
};

export const canonicalColor = (paletteWord: string): string | null => {
  const words = paletteWord.toLowerCase().trim().split(/\s+/);
  for (let i = words.length - 1; i >= 0; i--) {
    const word = COLOR_ALIASES[words[i]] ?? words[i];
    if (COLOR_HUES[word] != null) return word;
  }
  return null;
};

const cardColors = (card: FacetCard): string[] => [
  ...new Set(card.palette.map(canonicalColor).filter((color): color is string => color != null)),
];

// The hue a card sorts by: its first (dominant) palette color's bucket hue.
// Cards with no mappable palette sort last.
const cardHue = (card: FacetCard): number => {
  for (const word of card.palette) {
    const color = canonicalColor(word);
    if (color != null) return COLOR_HUES[color];
  }
  return Number.POSITIVE_INFINITY;
};

// ---------- Facet groups ----------

export type FacetGroupKey = "category" | "type" | "rarity" | "set" | "artist" | "color" | "mood";

// Supertypes the category group pins ahead of the subtype options.
const SUPERTYPE_ORDER = ["Pokémon", "Trainer", "Energy"];

export interface FacetGroupDef {
  key: FacetGroupKey;
  label: string;
  // True for facets derived from the vision index; unavailable on surfaces
  // whose data comes straight from the API (name-mode search).
  vision: boolean;
  values: (card: FacetCard) => string[];
  // Maps one selected value to a Pokemon TCG API Lucene clause so name-mode
  // search can filter API-side; null for vision facets.
  clause: ((value: string) => string) | null;
}

const quote = (value: string): string => `"${value.replace(/"/g, "")}"`;

export const FACET_GROUPS: FacetGroupDef[] = [
  {
    key: "category",
    label: "Category",
    vision: false,
    values: card => [...(card.supertype != null ? [card.supertype] : []), ...card.subtypes],
    clause: value =>
      SUPERTYPE_ORDER.includes(value)
        ? `supertype:${quote(value)}`
        : `subtypes:${quote(value)}`,
  },
  {
    key: "type",
    label: "Type",
    vision: false,
    values: card => card.types,
    clause: value => `types:${quote(value)}`,
  },
  {
    key: "rarity",
    label: "Rarity",
    vision: false,
    values: card => (card.rarity != null ? [card.rarity] : []),
    clause: value => `rarity:${quote(value)}`,
  },
  {
    key: "set",
    label: "Set",
    vision: false,
    values: card => [card.setName],
    clause: value => `set.name:${quote(value)}`,
  },
  {
    key: "artist",
    label: "Artist",
    vision: false,
    values: card => (card.artist != null ? [card.artist] : []),
    clause: value => `artist:${quote(value)}`,
  },
  { key: "color", label: "Color", vision: true, values: cardColors, clause: null },
  { key: "mood", label: "Mood", vision: true, values: card => card.mood, clause: null },
];

// ---------- Sorts ----------

export type SortKey = "relevance" | "recent" | "newest" | "oldest" | "dex" | "az" | "hue";

const releaseTime = (card: FacetCard): number =>
  card.releaseDate != null ? Date.parse(card.releaseDate) : Number.NaN;

const byName = (a: FacetCard, b: FacetCard): number =>
  a.name.localeCompare(b.name) || a.cardId.localeCompare(b.cardId);

// Comparators that push cards missing the sorted attribute to the end rather
// than interleaving them.
const compareWithMissingLast = (
  value: (card: FacetCard) => number,
  direction: 1 | -1,
): ((a: FacetCard, b: FacetCard) => number) => {
  return (a, b) => {
    const av = value(a);
    const bv = value(b);
    const aMissing = Number.isNaN(av) || av === Number.POSITIVE_INFINITY;
    const bMissing = Number.isNaN(bv) || bv === Number.POSITIVE_INFINITY;
    if (aMissing && bMissing) return byName(a, b);
    if (aMissing) return 1;
    if (bMissing) return -1;
    return (av - bv) * direction || byName(a, b);
  };
};

export interface SortDef {
  key: SortKey;
  label: string;
  // Undefined = keep the incoming order (relevance rank, save recency).
  compare?: (a: FacetCard, b: FacetCard) => number;
  // The API's orderBy expression for name-mode search; undefined = this sort
  // is unavailable API-side.
  apiOrderBy?: string;
}

export const SORTS: SortDef[] = [
  { key: "relevance", label: "Best match" },
  { key: "recent", label: "Recently saved" },
  {
    key: "newest",
    label: "Newest era",
    compare: compareWithMissingLast(releaseTime, -1),
    apiOrderBy: "-set.releaseDate,number",
  },
  {
    key: "oldest",
    label: "Oldest era",
    compare: compareWithMissingLast(releaseTime, 1),
    apiOrderBy: "set.releaseDate,number",
  },
  {
    key: "dex",
    label: "Pokédex order",
    compare: compareWithMissingLast(
      card => (card.nationalPokedexNumbers.length > 0 ? card.nationalPokedexNumbers[0] : Number.NaN),
      1,
    ),
    apiOrderBy: "nationalPokedexNumbers,name",
  },
  { key: "az", label: "Alphabetical", compare: byName, apiOrderBy: "name,number" },
  { key: "hue", label: "By color", compare: compareWithMissingLast(cardHue, 1) },
];

export const isSortKey = (value: string | undefined): value is SortKey =>
  value != null && SORTS.some(sort => sort.key === value);

// ---------- Filter/sort state <-> URL ----------

// Multi-select filters (values per group) plus the chosen sort. `sort: null`
// means "the surface's default" and stays out of the URL.
export interface FacetState {
  filters: Partial<Record<FacetGroupKey, string[]>>;
  sort: SortKey | null;
}

export type FacetSearchParams = Record<string, string | string[] | undefined>;

// Filter params are the group keys themselves (?type=Fire&type=Water&sort=az):
// readable, shareable, and repeated params give multi-select for free.
export const parseFacetState = (params: FacetSearchParams): FacetState => {
  const filters: FacetState["filters"] = {};
  for (const group of FACET_GROUPS) {
    const raw = params[group.key];
    const values = (Array.isArray(raw) ? raw : raw != null ? [raw] : [])
      .map(value => value.trim())
      .filter(value => value.length > 0);
    if (values.length > 0) filters[group.key] = [...new Set(values)];
  }
  const rawSort = params.sort;
  const sortValue = Array.isArray(rawSort) ? rawSort[0] : rawSort;
  return { filters, sort: isSortKey(sortValue) ? sortValue : null };
};

// Writes the state into an existing param set (which carries the surface's
// own params like q/mode/view) and returns it.
export const applyFacetStateToParams = (state: FacetState, params: URLSearchParams): URLSearchParams => {
  for (const group of FACET_GROUPS) {
    params.delete(group.key);
    for (const value of state.filters[group.key] ?? []) params.append(group.key, value);
  }
  params.delete("sort");
  if (state.sort != null) params.set("sort", state.sort);
  return params;
};

export const hasActiveFilters = (state: FacetState): boolean =>
  Object.values(state.filters).some(values => values != null && values.length > 0);

// ---------- Applying filters, counting, sorting ----------

const cardMatchesGroup = (card: FacetCard, group: FacetGroupDef, selected: string[]): boolean => {
  if (selected.length === 0) return true;
  const values = group.values(card);
  return selected.some(value => values.includes(value));
};

export const applyFacetFilters = (cards: FacetCard[], state: FacetState): FacetCard[] =>
  cards.filter(card =>
    FACET_GROUPS.every(group => cardMatchesGroup(card, group, state.filters[group.key] ?? [])),
  );

export interface FacetOption {
  value: string;
  count: number;
  selected: boolean;
}

export interface FacetGroupView {
  key: FacetGroupKey;
  label: string;
  options: FacetOption[];
}

// Option counts per group, computed against the cards that pass every OTHER
// group's filters (the standard OR-within-a-group convention: an option's
// count is the result size selecting it would produce). Options are ordered
// by count, except category pins the supertypes first.
export const buildFacetGroups = (allCards: FacetCard[], state: FacetState): FacetGroupView[] => {
  const views: FacetGroupView[] = [];
  for (const group of FACET_GROUPS) {
    const otherFiltered = allCards.filter(card =>
      FACET_GROUPS.every(
        other =>
          other.key === group.key ||
          cardMatchesGroup(card, other, state.filters[other.key] ?? []),
      ),
    );
    const counts = new Map<string, number>();
    for (const card of otherFiltered) {
      for (const value of new Set(group.values(card))) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    const selected = new Set(state.filters[group.key] ?? []);
    // A selected value stays listed even at count 0 so it can be unchecked.
    for (const value of selected) {
      if (!counts.has(value)) counts.set(value, 0);
    }
    if (counts.size === 0) continue;

    const options = [...counts.entries()]
      .map(([value, count]) => ({ value, count, selected: selected.has(value) }))
      .sort((a, b) => {
        if (group.key === "category") {
          const aSuper = SUPERTYPE_ORDER.indexOf(a.value);
          const bSuper = SUPERTYPE_ORDER.indexOf(b.value);
          if (aSuper !== -1 || bSuper !== -1) {
            if (aSuper === -1) return 1;
            if (bSuper === -1) return -1;
            return aSuper - bSuper;
          }
        }
        if (group.key === "color") {
          return (COLOR_HUES[a.value] ?? 999) - (COLOR_HUES[b.value] ?? 999);
        }
        return b.count - a.count || a.value.localeCompare(b.value);
      });
    views.push({ key: group.key, label: group.label, options });
  }
  return views;
};

export const sortFacetCards = (cards: FacetCard[], sort: SortKey | null): FacetCard[] => {
  const def = SORTS.find(candidate => candidate.key === sort);
  if (def?.compare == null) return cards;
  return [...cards].sort(def.compare);
};

// Lucene clauses for the selected filters, for surfaces that filter API-side
// (name-mode search). Vision facets have no API field and are skipped; OR
// within a group becomes a parenthesized OR clause.
export const facetLuceneClauses = (state: FacetState): string[] => {
  const clauses: string[] = [];
  for (const group of FACET_GROUPS) {
    if (group.clause == null) continue;
    const selected = state.filters[group.key] ?? [];
    if (selected.length === 0) continue;
    const parts = selected.map(group.clause);
    clauses.push(parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`);
  }
  return clauses;
};

export const apiOrderByFor = (sort: SortKey | null): string | undefined =>
  SORTS.find(candidate => candidate.key === sort)?.apiOrderBy;
