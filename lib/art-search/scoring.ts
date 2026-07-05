import type { ArtIndexEntry, ArtSearchResult, QueryTerm } from "./types";
import { EXPANSION_WEIGHT, VOCAB } from "./vocab";

// Words that carry no art semantics; dropped before matching.
const STOPWORDS = new Set([
  "a", "an", "and", "at", "by", "for", "from", "in", "into", "is", "it", "its",
  "of", "on", "or", "over", "the", "their", "them", "there", "this", "to",
  "under", "with", "card", "cards", "art", "artwork", "picture", "image",
  "pokemon", "pokémon", "something", "some", "show", "me", "find", "looking",
]);

// Field weights: a hit on the card name anchors known-answer queries; subject
// hits are the core of "what is IN the art"; the free-text searchText hit is
// the low-weight catch-all (it contains every other field plus scene text).
const NAME_WEIGHT = 6;
const SUBJECT_WEIGHT = 5;
const ACTION_WEIGHT = 3;
const MOOD_WEIGHT = 2.5;
const PALETTE_WEIGHT = 2;
const SETTING_WEIGHT = 2;
const STYLE_WEIGHT = 1.5;
const TEXT_WEIGHT = 1;

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

// Turn free text into weighted query terms: direct tokens at weight 1, vocab
// expansions at a discount. Exported for the pipeline's e2e sanity checks.
export const expandQuery = (query: string): QueryTerm[] => {
  const tokens = tokenize(query).filter(token => !STOPWORDS.has(token));
  const terms = new Map<string, number>();
  for (const token of tokens) {
    terms.set(token, Math.max(terms.get(token) ?? 0, 1));
    const expansions = VOCAB[token] ?? VOCAB[fold(token)] ?? [];
    for (const expansion of expansions) {
      terms.set(expansion, Math.max(terms.get(expansion) ?? 0, EXPANSION_WEIGHT));
    }
  }
  return [...terms.entries()].map(([term, weight]) => ({ term, weight }));
};

interface EntryDoc {
  entry: ArtIndexEntry;
  nameTokens: string[];
  nameRaw: string;
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
  actionTokens: tokenize(entry.action ?? ""),
  actionRaw: (entry.action ?? "").toLowerCase(),
  settingTokens: tokenize(entry.setting ?? ""),
  settingRaw: (entry.setting ?? "").toLowerCase(),
  styleTokens: tokenize(entry.style ?? ""),
  styleRaw: (entry.style ?? "").toLowerCase(),
  textTokens: tokenize(entry.searchText),
  textRaw: entry.searchText.toLowerCase(),
});

const scoreTermAgainstDoc = (doc: EntryDoc, queryTerm: QueryTerm): number => {
  const { term, weight, field } = queryTerm;
  if (field != null) {
    switch (field) {
      case "subjects":
        return termHitsList(term, doc.entry.subjects) ? SUBJECT_WEIGHT * weight : 0;
      case "action":
        return termHitsText(term, doc.actionTokens, doc.actionRaw) ? ACTION_WEIGHT * weight : 0;
      case "mood":
        return termHitsList(term, doc.entry.mood) ? MOOD_WEIGHT * weight : 0;
      case "palette":
        return termHitsList(term, doc.entry.palette) ? PALETTE_WEIGHT * weight : 0;
      case "setting":
        return termHitsText(term, doc.settingTokens, doc.settingRaw) ? SETTING_WEIGHT * weight : 0;
      case "style":
        return termHitsText(term, doc.styleTokens, doc.styleRaw) ? STYLE_WEIGHT * weight : 0;
    }
  }
  let best = 0;
  if (termHitsText(term, doc.nameTokens, doc.nameRaw)) best = Math.max(best, NAME_WEIGHT);
  if (termHitsList(term, doc.entry.subjects)) best = Math.max(best, SUBJECT_WEIGHT);
  if (termHitsText(term, doc.actionTokens, doc.actionRaw)) best = Math.max(best, ACTION_WEIGHT);
  if (termHitsList(term, doc.entry.mood)) best = Math.max(best, MOOD_WEIGHT);
  if (termHitsList(term, doc.entry.palette)) best = Math.max(best, PALETTE_WEIGHT);
  if (termHitsText(term, doc.settingTokens, doc.settingRaw)) best = Math.max(best, SETTING_WEIGHT);
  if (termHitsText(term, doc.styleTokens, doc.styleRaw)) best = Math.max(best, STYLE_WEIGHT);
  if (best === 0 && termHitsText(term, doc.textTokens, doc.textRaw)) best = TEXT_WEIGHT;
  return best * weight;
};

export const rankEntries = (
  entries: ArtIndexEntry[],
  termGroups: QueryTerm[][],
  limit: number,
): ArtSearchResult[] => {
  const docs = entries.map(toDoc);
  const results: ArtSearchResult[] = [];
  for (const doc of docs) {
    let score = 0;
    const matched: string[] = [];
    for (const group of termGroups) {
      for (const queryTerm of group) {
        const termScore = scoreTermAgainstDoc(doc, queryTerm);
        if (termScore > 0) {
          score += termScore;
          if (!matched.includes(queryTerm.term)) matched.push(queryTerm.term);
        }
      }
    }
    if (score > 0) results.push({ entry: doc.entry, score, matched });
  }
  results.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return results.slice(0, limit);
};
