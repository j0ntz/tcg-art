import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { deckCards, decks } from "@/lib/db/schema";

export interface DeckSummary {
  id: string;
  name: string;
  cardCount: number;
  updatedAt: Date;
}

export interface DeckCardItem {
  cardId: string;
  addedAt: Date;
}

export { DECK_NAME_MAX, sanitizeDeckName } from "./name";

// A user's decks with card counts, most recently touched first. Null when no
// database is available (same degrade contract as getFavorites).
export const getDecks = async (userId: string): Promise<DeckSummary[] | null> => {
  const db = await getDb();
  if (db == null) return null;
  const rows = await db
    .select({
      id: decks.id,
      name: decks.name,
      updatedAt: decks.updatedAt,
      cardCount: sql<number>`count(${deckCards.cardId})::int`,
    })
    .from(decks)
    .leftJoin(deckCards, eq(deckCards.deckId, decks.id))
    .where(eq(decks.userId, userId))
    .groupBy(decks.id)
    .orderBy(desc(decks.updatedAt), desc(decks.id));
  return rows;
};

// One deck, ownership-checked: null when it does not exist OR belongs to
// someone else (callers 404 either way, revealing nothing).
export const getDeck = async (
  userId: string,
  deckId: string,
): Promise<{ id: string; name: string; createdAt: Date } | null> => {
  const db = await getDb();
  if (db == null) return null;
  const rows = await db
    .select({ id: decks.id, name: decks.name, createdAt: decks.createdAt })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
};

// A deck's cards, newest addition first (the deck view's default order).
export const getDeckCards = async (deckId: string): Promise<DeckCardItem[]> => {
  const db = await getDb();
  if (db == null) return [];
  const rows = await db
    .select({ cardId: deckCards.cardId, addedAt: deckCards.addedAt })
    .from(deckCards)
    .where(eq(deckCards.deckId, deckId))
    .orderBy(desc(deckCards.addedAt), desc(deckCards.cardId));
  return rows;
};

// deckId -> contains-this-card, for one user and one card: powers the
// add-to-deck menu's checked states on a card surface.
export const getDeckMembership = async (userId: string, cardId: string): Promise<Set<string>> => {
  const db = await getDb();
  if (db == null) return new Set();
  const rows = await db
    .select({ deckId: deckCards.deckId })
    .from(deckCards)
    .innerJoin(decks, eq(decks.id, deckCards.deckId))
    .where(and(eq(decks.userId, userId), eq(deckCards.cardId, cardId)));
  return new Set(rows.map(row => row.deckId));
};
