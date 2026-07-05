import { cardArtIndex } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import snapshot from "@/data/art-index.json";
import { parseQueryWithHaiku } from "./haiku";
import { expandQuery, rankEntries } from "./scoring";
import type { ArtIndexEntry, ArtSearchResponse, QueryTerm } from "./types";

export type { ArtIndexEntry, ArtSearchResult, ArtSearchResponse } from "./types";

const RESULT_LIMIT = 24;
const DB_CACHE_MS = 5 * 60 * 1000;

// The committed snapshot is the source that ships inside the build, so search
// works on zero-env deployments (today's Vercel previews and production have
// no DATABASE_URL). When a database IS configured and the pipeline has filled
// card_art_index, the live rows win so a re-index doesn't need a redeploy.
const snapshotEntries = snapshot.entries as ArtIndexEntry[];

interface IndexCache {
  entries: ArtIndexEntry[];
  loadedAt: number;
}

const globalCache = globalThis as unknown as { tcgArtIndexCache?: IndexCache };

const loadIndex = async (): Promise<ArtIndexEntry[]> => {
  const cached = globalCache.tcgArtIndexCache;
  if (cached != null && Date.now() - cached.loadedAt < DB_CACHE_MS) {
    return cached.entries;
  }
  let entries = snapshotEntries;
  try {
    const db = await getDb();
    if (db != null) {
      const rows = await db.select().from(cardArtIndex);
      if (rows.length > 0) entries = rows;
    }
  } catch (e: unknown) {
    // A broken/unmigrated database must not take search down; the committed
    // snapshot is always available.
    console.error("art-search: falling back to snapshot index", e);
  }
  globalCache.tcgArtIndexCache = { entries, loadedAt: Date.now() };
  return entries;
};

export const searchArt = async (rawQuery: string): Promise<ArtSearchResponse> => {
  const query = rawQuery.trim();
  const entries = await loadIndex();
  if (query.length === 0) {
    return { query, mode: "lexical", indexSize: entries.length, results: [] };
  }

  const lexicalTerms = expandQuery(query);
  const haikuTerms: QueryTerm[] | null = await parseQueryWithHaiku(query);
  const termGroups = haikuTerms != null ? [lexicalTerms, haikuTerms] : [lexicalTerms];

  return {
    query,
    mode: haikuTerms != null ? "haiku" : "lexical",
    indexSize: entries.length,
    results: rankEntries(entries, termGroups, RESULT_LIMIT),
  };
};
