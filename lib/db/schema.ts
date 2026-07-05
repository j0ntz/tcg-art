import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// Auth.js-compatible tables (column names match @auth/drizzle-adapter's default
// Postgres schema so the adapter works unmodified), extended for credentials
// login. Future features (card binders/portfolios) should reference users.id
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

// A user's card collection (the /binder page). One row per (user, card); adding
// a card the user already owns increments quantity instead of inserting a second
// row. Only the Pokemon TCG API card id is stored (never card blobs); display
// data is fetched through lib/pokemon.ts at render time.
export const collectionItems = pgTable(
  "collection_item",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: text("cardId").notNull(),
    quantity: integer("quantity").notNull().default(1),
    acquiredAt: timestamp("acquiredAt", { mode: "date" }).notNull().defaultNow(),
  },
  item => [primaryKey({ columns: [item.userId, item.cardId] })],
);
