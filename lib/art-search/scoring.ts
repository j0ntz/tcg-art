import type { ArtIndexEntry, ArtSearchResult, QueryConcept, QueryTerm } from "./types";
import { EXPANSION_WEIGHT, VOCAB } from "./vocab";

// Words that carry no art semantics; dropped before matching.
const STOPWORDS = new Set([
  "a", "an", "and", "at", "by", "for", "from", "in", "into", "is", "it", "its",
  "of", "on", "or", "over", "the", "their", "them", "there", "this", "to",
  "under", "with", "card", "cards", "art", "artwork", "picture", "image",
  "pokemon", "pokémon", "something", "some", "show", "me", "find", "looking",
]);

// All ranking knobs in one place so the scoring function stays unit-testable
// and its behavior is tuned by data, not scattered constants.
//
// - fields: how strongly a hit in each structured field counts. Ordering is
//   subjects > scene > action > mood > palette/setting > style > free text, so
//   "what is IN the art" (subjects) outweighs the prose scene sentence, which
//   outweighs tone/color/flavor. name anchors known-answer (species) queries.
// - coverageBonus: each ADDITIONAL distinct query concept a row matches
//   multiplies its score, so a row covering 3 of the query's attributes beats a
//   row that only matches 1 high-frequency attribute very strongly.
// - idfFloor: the least a common concept can be damped to. Generic tokens
//   ("bird", "pokemon") that hit a large share of the index get pushed toward
//   this floor so they cannot dominate rank on frequency alone.
export const SCORING_CONFIG = {
  fields: {
    name: 6,
    subjects: 5,
    scene: 2.8,
    action: 3,
    mood: 2.5,
    palette: 2,
    setting: 2,
    style: 1.5,
    text: 1,
  },
  coverageBonus: 0.55,
  idfFloor: 0.15,
} as const;

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9é]+/)
    .filter(token => token.length > 1);

// Naive singular/plural folding: "waves" matches "wave" and vice versa.
const fold = (token: string): string => (token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token);

const tokensMatch = (a: string, b: string): boolean => fold(a) === fold(b);

// A term (possibly multi-word, e.g. "riding a wave") hits a text field when
// every one of its words appears, or as a raw substring for phrases.
const termHitsText = (term: string, tokens: string[], raw: string): boolean => {
  if (term.includes(" ")) return raw.includes(term);
  return tokens.some(token => tokensMatch(token, term));
};

const termHitsList = (term: string, list: string[]): boolean =>
  list.some(item => {
    const itemTokens = tokenize(item);
    return termHitsText(term, itemTokens, item.toLowerCase());
  });

// Turn free text into query concepts: one concept per distinct user word,
// carrying the direct token (weight 1) plus its vocab expansions at a discount.
// Grouping expansions under their origin word is what lets scoring count the
// concept once toward coverage and damp it once by IDF. Exported for the
// pipeline's e2e sanity checks.
export const expandQuery = (query: string): QueryConcept[] => {
  const tokens = tokenize(query).filter(token => !STOPWORDS.has(token));
  // Group by folded token so "wave"/"waves" collapse into one concept, but keep
  // the first raw token as the display key so matched: chips read naturally.
  const concepts = new Map<string, { key: string; terms: Map<string, number> }>();
  for (const token of tokens) {
    const foldKey = fold(token);
    const concept = concepts.get(foldKey) ?? { key: token, terms: new Map<string, number>() };
    concept.terms.set(token, Math.max(concept.terms.get(token) ?? 0, 1));
    const expansions = VOCAB[token] ?? VOCAB[foldKey] ?? [];
    for (const expansion of expansions) {
      concept.terms.set(expansion, Math.max(concept.terms.get(expansion) ?? 0, EXPANSION_WEIGHT));
    }
    concepts.set(foldKey, concept);
  }
  // Drop an expansion when the user ALSO typed that word as its own concept
  // (e.g. "turtle" expands to "shell" but the query already has a "shell"
  // concept). Otherwise one index word would cover two concepts and inflate the
  // coverage bonus for rows that really match a single attribute.
  const ownKeys = new Set(concepts.keys());
  return [...concepts.values()].map(concept => ({
    key: concept.key,
    terms: [...concept.terms.entries()]
      .filter(([term, weight]) => weight >= 1 || !ownKeys.has(fold(term)) || fold(term) === fold(concept.key))
      .map(([term, weight]) => ({ term, weight })),
  }));
};

interface EntryDoc {
  entry: ArtIndexEntry;
  nameTokens: string[];
  nameRaw: string;
  sceneTokens: string[];
  sceneRaw: string;
  actionTokens: string[];
  actionRaw: string;
  settingTokens: string[];
  settingRaw: string;
  styleTokens: string[];
  styleRaw: string;
  textTokens: string[];
  textRaw: string;
}

// Tokenizing every entry once per search keeps the per-term loop cheap; at the
// current index scale (hundreds to ~20k rows) a full scan is single-digit ms.
const toDoc = (entry: ArtIndexEntry): EntryDoc => ({
  entry,
  nameTokens: tokenize(entry.name),
  nameRaw: entry.name.toLowerCase(),
  sceneTokens: tokenize(entry.scene),
  sceneRaw: entry.scene.toLowerCase(),
  actionTokens: tokenize(entry.action ?? ""),
  actionRaw: (entry.action ?? "").toLowerCase(),
  settingTokens: tokenize(entry.setting ?? ""),
  settingRaw: (entry.setting ?? "").toLowerCase(),
  styleTokens: tokenize(entry.style ?? ""),
  styleRaw: (entry.style ?? "").toLowerCase(),
  textTokens: tokenize(entry.searchText),
  textRaw: entry.searchText.toLowerCase(),
});

// Best raw field weight a single query term earns against one doc, before the
// term's own weight (direct vs expansion) is applied. A field-scoped term only
// looks at that field; an unscoped term takes the strongest field it hits.
const termFieldWeight = (doc: EntryDoc, queryTerm: QueryTerm): number => {
  const { term, field } = queryTerm;
  const F = SCORING_CONFIG.fields;
  if (field != null) {
    switch (field) {
      case "subjects":
        return termHitsList(term, doc.entry.subjects) ? F.subjects : 0;
      case "scene":
        return termHitsText(term, doc.sceneTokens, doc.sceneRaw) ? F.scene : 0;
      case "action":
        return termHitsText(term, doc.actionTokens, doc.actionRaw) ? F.action : 0;
      case "mood":
        return termHitsList(term, doc.entry.mood) ? F.mood : 0;
      case "palette":
        return termHitsList(term, doc.entry.palette) ? F.palette : 0;
      case "setting":
        return termHitsText(term, doc.settingTokens, doc.settingRaw) ? F.setting : 0;
      case "style":
        return termHitsText(term, doc.styleTokens, doc.styleRaw) ? F.style : 0;
    }
  }
  let best = 0;
  if (termHitsText(term, doc.nameTokens, doc.nameRaw)) best = Math.max(best, F.name);
  if (termHitsList(term, doc.entry.subjects)) best = Math.max(best, F.subjects);
  if (termHitsText(term, doc.sceneTokens, doc.sceneRaw)) best = Math.max(best, F.scene);
  if (termHitsText(term, doc.actionTokens, doc.actionRaw)) best = Math.max(best, F.action);
  if (termHitsList(term, doc.entry.mood)) best = Math.max(best, F.mood);
  if (termHitsList(term, doc.entry.palette)) best = Math.max(best, F.palette);
  if (termHitsText(term, doc.settingTokens, doc.settingRaw)) best = Math.max(best, F.setting);
  if (termHitsText(term, doc.styleTokens, doc.styleRaw)) best = Math.max(best, F.style);
  if (best === 0 && termHitsText(term, doc.textTokens, doc.textRaw)) best = F.text;
  return best;
};

// A concept's raw contribution to a doc: the strongest single (field x term)
// hit among the concept's direct token and its expansions. Taking the max (not
// the sum) is what makes the concept count once, so coverage across DISTINCT
// concepts, not synonym pile-up within one, drives rank.
const conceptRawScore = (doc: EntryDoc, concept: QueryConcept): number => {
  let best = 0;
  for (const term of concept.terms) {
    const fieldWeight = termFieldWeight(doc, term);
    if (fieldWeight > 0) best = Math.max(best, fieldWeight * term.weight);
  }
  return best;
};

// IDF-style damping in (0, 1]: a concept matching a large share of the corpus
// (generic "bird", "pokemon") is pushed toward idfFloor; a concept matching few
// rows keeps near its full field weight. Normalizing by log(n + 1) keeps the
// factor scale-stable as the index grows.
const idfFactor = (docFreq: number, corpusSize: number): number => {
  if (docFreq <= 0 || corpusSize <= 0) return 1;
  const raw = Math.log((corpusSize + 1) / (docFreq + 1)) / Math.log(corpusSize + 1);
  return Math.max(SCORING_CONFIG.idfFloor, raw);
};

export const rankEntries = (
  entries: ArtIndexEntry[],
  conceptGroups: QueryConcept[][],
  limit: number,
): ArtSearchResult[] => {
  const docs = entries.map(toDoc);
  const concepts = conceptGroups.flat();
  if (concepts.length === 0) return [];

  // Pass 1: raw concept scores per doc, and each concept's document frequency
  // (rows it hits at all) for IDF damping.
  const rawByDoc: number[][] = docs.map(() => new Array<number>(concepts.length).fill(0));
  const docFreq = new Array<number>(concepts.length).fill(0);
  for (let d = 0; d < docs.length; d++) {
    for (let c = 0; c < concepts.length; c++) {
      const raw = conceptRawScore(docs[d], concepts[c]);
      rawByDoc[d][c] = raw;
      if (raw > 0) docFreq[c] += 1;
    }
  }
  const idf = concepts.map((_, c) => idfFactor(docFreq[c], docs.length));

  // Pass 2: damped sum, then a coverage multiplier that rewards matching more
  // DISTINCT concept keys (a row covering 3 query attributes outranks one that
  // only matches a single high-frequency attribute).
  const results: ArtSearchResult[] = [];
  for (let d = 0; d < docs.length; d++) {
    let base = 0;
    const coveredKeys = new Set<string>();
    for (let c = 0; c < concepts.length; c++) {
      const raw = rawByDoc[d][c];
      if (raw <= 0) continue;
      base += raw * idf[c];
      coveredKeys.add(concepts[c].key);
    }
    if (base <= 0) continue;
    const coverageMultiplier = 1 + SCORING_CONFIG.coverageBonus * (coveredKeys.size - 1);
    results.push({
      entry: docs[d].entry,
      score: base * coverageMultiplier,
      matched: [...coveredKeys],
    });
  }
  results.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return results.slice(0, limit);
};
