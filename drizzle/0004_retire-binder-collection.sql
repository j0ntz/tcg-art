-- Binder retirement: every owned card becomes a favorite (quantity semantics
-- dropped; savedAt inherits the acquisition time), then the collection table
-- goes away.
INSERT INTO "favorite" ("userId", "cardId", "savedAt")
SELECT "userId", "cardId", "acquiredAt" FROM "collection_item"
ON CONFLICT ("userId", "cardId") DO NOTHING;--> statement-breakpoint
DROP TABLE "collection_item" CASCADE;
