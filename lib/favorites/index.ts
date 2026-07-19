import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { favorites } from "@/lib/db/schema";

export interface FavoriteItem {
  cardId: string;
  savedAt: Date;
}

// A user's saved cards, newest save first (the /saves default order). Returns
// null when no database is available (bare production deployment) so pages
// can render a "not provisioned" notice instead of crashing; an empty saves
// list is [].
export const getFavorites = async (userId: string): Promise<FavoriteItem[] | null> => {
  const db = await getDb();
  if (db == null) return null;
  const rows = await db
    .select({ cardId: favorites.cardId, savedAt: favorites.savedAt })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.savedAt), desc(favorites.cardId));
  return rows;
};

// The card ids a user has saved; used by search/deck/detail surfaces to render
// each heart in its correct state. Empty set when the database is unavailable
// (the toggles still render; the action itself degrades).
export const getFavoriteCardIds = async (userId: string): Promise<Set<string>> => {
  const items = await getFavorites(userId);
  return new Set((items ?? []).map(item => item.cardId));
};
