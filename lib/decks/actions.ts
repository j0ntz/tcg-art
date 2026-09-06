"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getDb, type Db } from "@/lib/db";
import { deckCards, decks } from "@/lib/db/schema";
import { CARD_ID_PATTERN } from "@/lib/pokemon";
import { sanitizeDeckName } from "./name";

// Deck mutations. Every card/rename/delete action re-checks that the deck
// belongs to the session user (the deck id travels through the client), and
// every mutation touches deck.updatedAt so the /decks list orders by real
// activity. Progressive-enhancement friendly: all work as bare <form action>.

const revalidateDeckPages = (deckId: string): void => {
  revalidatePath("/decks");
  revalidatePath(`/decks/${deckId}`);
};

const ownedDeckId = async (
  db: Db,
  userId: string,
  value: FormDataEntryValue | null,
): Promise<string | null> => {
  if (typeof value !== "string" || value.length === 0) return null;
  const rows = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, value), eq(decks.userId, userId)))
    .limit(1);
  return rows[0]?.id ?? null;
};

const touchDeck = async (db: Db, deckId: string): Promise<void> => {
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId));
};

export const createDeck = async (formData: FormData): Promise<void> => {
  const name = sanitizeDeckName(formData.get("name"));
  if (name == null) return;

  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const db = await getDb();
  if (db == null) {
    console.error("createDeck: no database available");
    return;
  }

  const inserted = await db
    .insert(decks)
    .values({ userId: user.id, name })
    .returning({ id: decks.id });
  revalidatePath("/decks");

  // A card id may ride along (the "New deck" path inside the add-to-deck
  // menu): the deck is born holding that card.
  const cardId = formData.get("cardId");
  const deckId = inserted[0]?.id;
  if (deckId != null && typeof cardId === "string" && CARD_ID_PATTERN.test(cardId)) {
    await db.insert(deckCards).values({ deckId, cardId }).onConflictDoNothing();
    revalidatePath(`/decks/${deckId}`);
  }
};

export const renameDeck = async (formData: FormData): Promise<void> => {
  const name = sanitizeDeckName(formData.get("name"));
  if (name == null) return;

  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const db = await getDb();
  if (db == null) return;

  const deckId = await ownedDeckId(db, user.id, formData.get("deckId"));
  if (deckId == null) return;

  await db.update(decks).set({ name, updatedAt: new Date() }).where(eq(decks.id, deckId));
  revalidateDeckPages(deckId);
};

export const deleteDeck = async (formData: FormData): Promise<void> => {
  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const db = await getDb();
  if (db == null) return;

  const deckId = await ownedDeckId(db, user.id, formData.get("deckId"));
  if (deckId == null) return;

  // deck_card rows go with it via the FK cascade.
  await db.delete(decks).where(eq(decks.id, deckId));
  revalidatePath("/decks");
  redirect("/decks");
};

export const addCardToDeck = async (formData: FormData): Promise<void> => {
  const cardId = formData.get("cardId");
  if (typeof cardId !== "string" || !CARD_ID_PATTERN.test(cardId)) return;

  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const db = await getDb();
  if (db == null) return;

  const deckId = await ownedDeckId(db, user.id, formData.get("deckId"));
  if (deckId == null) return;

  await db.insert(deckCards).values({ deckId, cardId }).onConflictDoNothing();
  await touchDeck(db, deckId);
  revalidateDeckPages(deckId);
};

export const removeCardFromDeck = async (formData: FormData): Promise<void> => {
  const cardId = formData.get("cardId");
  if (typeof cardId !== "string" || !CARD_ID_PATTERN.test(cardId)) return;

  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const db = await getDb();
  if (db == null) return;

  const deckId = await ownedDeckId(db, user.id, formData.get("deckId"));
  if (deckId == null) return;

  await db
    .delete(deckCards)
    .where(and(eq(deckCards.deckId, deckId), eq(deckCards.cardId, cardId)));
  await touchDeck(db, deckId);
  revalidateDeckPages(deckId);
};
