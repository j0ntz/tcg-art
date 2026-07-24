import { getIndexEntriesByIds } from "@/lib/art-search";
import { getCardsByIds } from "@/lib/pokemon";
import {
  facetCardFromApiCard,
  facetCardFromIndexEntry,
  type FacetCard,
} from "./index";

// Resolves stored card ids (favorites, deck rows) to the facet/display shape.
// The art index is preferred (it carries the vision attributes and costs no
// network round-trip); cards outside the index fall back to a batched Pokemon
// TCG API lookup, which still supplies every game-metadata facet. Ids neither
// source knows are absent from the result (callers keep the stored row; the
// card just doesn't render).
export const resolveFacetCards = async (cardIds: string[]): Promise<Map<string, FacetCard>> => {
  const indexed = await getIndexEntriesByIds(cardIds);
  const missing = cardIds.filter(cardId => !indexed.has(cardId));
  const fromApi = missing.length > 0 ? await getCardsByIds(missing) : null;

  const resolved = new Map<string, FacetCard>();
  for (const cardId of cardIds) {
    const entry = indexed.get(cardId);
    if (entry != null) {
      resolved.set(cardId, facetCardFromIndexEntry(entry));
      continue;
    }
    const card = fromApi?.get(cardId);
    if (card != null) resolved.set(cardId, facetCardFromApiCard(card));
  }
  return resolved;
};
