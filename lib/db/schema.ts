import { integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// Auth.js-compatible tables (column names match @auth/drizzle-adapter's default
// Postgres schema so the adapter works unmodified), extended for credentials
// login. Future features (saves/decks and beyond) should reference users.id
// with a foreign key, the same way accounts.userId does below.

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  // Stored lowercase for credentials accounts so lookups are case-insensitive.
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // bcrypt hash; null for OAuth-only (Google) accounts.
  passwordHash: text("passwordHash"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

// One row per linked OAuth provider account (Google today). Shape required by
// the Auth.js adapter contract, including the snake_case token columns.
export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  account => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

// A user's saved cards (the /saves page). One row per (user, card): a favorite
// is a boolean relation, not an ownership count (the old binder's quantity
// semantics are retired; migration 0003 folded any owned card into one
// favorite row). Only the Pokemon TCG API card id is stored (never card
// blobs); display data comes from the art index or lib/pokemon.ts at render.
export const favorites = pgTable(
  "favorite",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: text("cardId").notNull(),
    savedAt: timestamp("savedAt", { mode: "date" }).notNull().defaultNow(),
  },
  favorite => [primaryKey({ columns: [favorite.userId, favorite.cardId] })],
);

// A user-created named deck. v1 enforces no game rules (no 60-card limit, no
// copy limits); if legality rules layer on later they become derived checks
// over deck_card rows (plus e.g. a nullable `format` column here), not a
// schema rewrite.
export const decks = pgTable("deck", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// Deck membership: one row per (deck, card). A future rules layer would add a
// `count` column here for multi-copy formats; v1 decks are art groupings, so
// membership is boolean like favorites.
export const deckCards = pgTable(
  "deck_card",
  {
    deckId: text("deckId")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    cardId: text("cardId").notNull(),
    addedAt: timestamp("addedAt", { mode: "date" }).notNull().defaultNow(),
  },
  deckCard => [primaryKey({ columns: [deckCard.deckId, deckCard.cardId] })],
);

// Semantic art index: one row per card, produced offline by
// scripts/index-card-art.mjs (Haiku vision descriptions of the card art).
// Display fields (name/set/images) are denormalized so search results render
// without a Pokemon TCG API round-trip. `model` records the describer that
// produced the row ("claude-haiku-4-5" or the metadata-only "stub-metadata-v1");
// the pipeline re-indexes rows whose model is not the current target, which is
// how stub rows get upgraded to real vision rows.
export const cardArtIndex = pgTable("card_art_index", {
  cardId: text("cardId").primaryKey(),
  name: text("name").notNull(),
  setId: text("setId").notNull(),
  setName: text("setName").notNull(),
  number: text("number").notNull(),
  rarity: text("rarity"),
  artist: text("artist"),
  imageSmall: text("imageSmall").notNull(),
  imageLarge: text("imageLarge").notNull(),
  // Structured description of the ART (not the card frame): what is depicted.
  scene: text("scene").notNull(),
  subjects: jsonb("subjects").$type<string[]>().notNull(),
  action: text("action"),
  mood: jsonb("mood").$type<string[]>().notNull(),
  palette: jsonb("palette").$type<string[]>().notNull(),
  setting: text("setting"),
  style: text("style"),
  // Game metadata for faceted filtering/sorting, merged from the Pokemon TCG
  // API dataset by scripts/enrich-card-metadata.mjs (metadata only; the vision
  // fields above are never re-described). Nullable: enrichment is best-effort
  // and older rows may predate it.
  supertype: text("supertype"),
  subtypes: jsonb("subtypes").$type<string[]>(),
  types: jsonb("types").$type<string[]>(),
  nationalPokedexNumbers: jsonb("nationalPokedexNumbers").$type<number[]>(),
  releaseDate: text("releaseDate"),
  // Lowercased concatenation of every describable field; the lexical ranker
  // scores against this plus the structured fields above.
  searchText: text("searchText").notNull(),
  model: text("model").notNull(),
  indexedAt: timestamp("indexedAt", { mode: "date" }).notNull().defaultNow(),
});
