// One indexed card: the offline pipeline (scripts/index-card-art.mjs) produces
// these rows, stored in Postgres (card_art_index) and mirrored into the
// committed snapshot data/art-index.json so zero-env deployments can search.
export interface ArtIndexEntry {
  cardId: string;
  name: string;
  setId: string;
  setName: string;
  number: string;
  rarity: string | null;
  artist: string | null;
  imageSmall: string;
  imageLarge: string;
  scene: string;
  subjects: string[];
  action: string | null;
  mood: string[];
  palette: string[];
  setting: string | null;
  style: string | null;
  searchText: string;
  model: string;
}

export interface ArtSearchResult {
  entry: ArtIndexEntry;
  score: number;
  // The query-side terms that hit this card, for the "matched:" chips in the UI
  // and for honest e2e reporting.
  matched: string[];
}

// How a query was understood: "haiku" when the Haiku query parser contributed
// (ANTHROPIC_API_KEY present and the call succeeded), otherwise "lexical".
export type ArtQueryMode = "haiku" | "lexical";

export interface ArtSearchResponse {
  query: string;
  mode: ArtQueryMode;
  indexSize: number;
  results: ArtSearchResult[];
}

// A weighted query-side term produced by tokenization, vocab expansion, or the
// Haiku parser. `field` narrows scoring to one structured field; undefined
// means "score against everything".
export interface QueryTerm {
  term: string;
  weight: number;
  field?: "subjects" | "action" | "mood" | "palette" | "setting" | "style";
}
