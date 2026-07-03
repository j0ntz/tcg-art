"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema";
import { CARD_ID_PATTERN } from "@/lib/pokemon";

// Form actions for the binder. Both are progressive-enhancement friendly
// (plain <form action={...}> submits work without client JS): on success they
// revalidate the pages that show collection state and the form's page
// re-renders with the new data. Failures are silent no-ops by design at this
// stage; the re-render simply shows the unchanged state.

const cardIdFrom = (formData: FormData): string | null => {
  const value = formData.get("cardId");
  if (typeof value !== "string" || !CARD_ID_PATTERN.test(value)) return null;
  return value;
};

const revalidateCollectionPages = (): void => {
  revalidatePath("/binder");
  revalidatePath("/search");
};

// Adds one copy of a card; a card already in the binder gets its quantity
// incremented (the collection table keys on user+card, never duplicate rows).
export const addCardToCollection = async (formData: FormData): Promise<void> => {
  const cardId = cardIdFrom(formData);
  if (cardId == null) return;

  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const db = await getDb();
  if (db == null) {
    console.error("addCardToCollection: no database available");
    return;
  }

  await db
    .insert(collectionItems)
    .values({ userId: user.id, cardId })
    .onConflictDoUpdate({
      target: [collectionItems.userId, collectionItems.cardId],
      set: { quantity: sql`${collectionItems.quantity} + 1` },
    });
  revalidateCollectionPages();
};

// Removes a card from the binder entirely (all copies): one clear gesture on
// the /binder page rather than quantity bookkeeping.
export const removeCardFromCollection = async (formData: FormData): Promise<void> => {
  const cardId = cardIdFrom(formData);
  if (cardId == null) return;

  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const db = await getDb();
  if (db == null) {
    console.error("removeCardFromCollection: no database available");
    return;
  }

  await db
    .delete(collectionItems)
    .where(and(eq(collectionItems.userId, user.id), eq(collectionItems.cardId, cardId)));
  revalidateCollectionPages();
};
