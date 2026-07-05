CREATE TABLE "collection_item" (
	"userId" text NOT NULL,
	"cardId" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"acquiredAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_userId_cardId_pk" PRIMARY KEY("userId","cardId")
);
--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;