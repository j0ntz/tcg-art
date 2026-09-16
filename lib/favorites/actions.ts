"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { favorites } from "@/lib/db/schema";
import { CARD_ID_PATTERN } from "@/lib/pokemon";

// The heart toggle's server half. Client components call it optimistically
// (the heart flips immediately; revalidation trues it up), and it still works
// as a plain <form action> without JS. Failures are silent no-ops: the
// re-render shows the unchanged state.

const revalidateSavedPages = (): void => {
  revalidatePath("/saves");
  revalidatePath("/search");
  revalidatePath("/decks", "layout");
};

export const toggleFavorite = async (formData: FormData): Promise<void> => {
  const cardId = formData.get("cardId");
  if (typeof cardId !== "string" || !CARD_ID_PATTERN.test(cardId)) return;

  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const db = await getDb();
  if (db == null) {
    console.error("toggleFavorite: no database available");
    return;
  }

  const deleted = await db
    .delete(favorites)
    .where(and(eq(favorites.userId, user.id), eq(favorites.cardId, cardId)))
    .returning({ cardId: favorites.cardId });
  if (deleted.length === 0) {
    await db.insert(favorites).values({ userId: user.id, cardId }).onConflictDoNothing();
  }
  revalidateSavedPages();
};
