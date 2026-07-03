import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema";

export interface CollectionItem {
  cardId: string;
  quantity: number;
  acquiredAt: Date;
}

// A user's collection rows, newest acquisition first (the order every /binder
// display mode uses). Returns null when no database is available (bare
// production deployment) so pages can render a "not provisioned" notice
// instead of crashing; an empty collection is [].
export const getCollectionItems = async (userId: string): Promise<CollectionItem[] | null> => {
  const db = await getDb();
  if (db == null) return null;
  const rows = await db
    .select({
      cardId: collectionItems.cardId,
      quantity: collectionItems.quantity,
      acquiredAt: collectionItems.acquiredAt,
    })
    .from(collectionItems)
    .where(eq(collectionItems.userId, userId))
    .orderBy(desc(collectionItems.acquiredAt), desc(collectionItems.cardId));
  return rows;
};

// cardId -> quantity for one user; used by /search to mark cards already in
// the binder. Empty map when the database is unavailable (the add buttons
// still render; the action itself degrades).
export const getOwnedQuantities = async (userId: string): Promise<Map<string, number>> => {
  const items = await getCollectionItems(userId);
  return new Map((items ?? []).map(item => [item.cardId, item.quantity]));
};
