CREATE TABLE "deck_card" (
	"deckId" text NOT NULL,
	"cardId" text NOT NULL,
	"addedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deck_card_deckId_cardId_pk" PRIMARY KEY("deckId","cardId")
);
--> statement-breakpoint
CREATE TABLE "deck" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite" (
	"userId" text NOT NULL,
	"cardId" text NOT NULL,
	"savedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_userId_cardId_pk" PRIMARY KEY("userId","cardId")
);
--> statement-breakpoint
ALTER TABLE "card_art_index" ADD COLUMN "supertype" text;--> statement-breakpoint
ALTER TABLE "card_art_index" ADD COLUMN "subtypes" jsonb;--> statement-breakpoint
ALTER TABLE "card_art_index" ADD COLUMN "types" jsonb;--> statement-breakpoint
ALTER TABLE "card_art_index" ADD COLUMN "nationalPokedexNumbers" jsonb;--> statement-breakpoint
ALTER TABLE "card_art_index" ADD COLUMN "releaseDate" text;--> statement-breakpoint
ALTER TABLE "deck_card" ADD CONSTRAINT "deck_card_deckId_deck_id_fk" FOREIGN KEY ("deckId") REFERENCES "public"."deck"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck" ADD CONSTRAINT "deck_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;