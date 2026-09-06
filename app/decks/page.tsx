import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { DECK_NAME_MAX, getDecks } from "@/lib/decks";
import { createDeck } from "@/lib/decks/actions";
import { cn } from "@/lib/utils";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { cardVariants } from "../components/ui/Card";

export const metadata: Metadata = {
  title: "Your Decks",
  description: "Named groupings of the cards you collect, each with the full filter set.",
};

const updatedFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Auth-gated deck list: the hairline ledger of the user's decks plus the
// create form. Decks are purposeful groupings; no game-rule enforcement in
// v1, so any card can go in any deck.
const DecksPage = async () => {
  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const decks = await getDecks(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-gutter py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-heading font-bold tracking-tight text-foreground">
          Your Decks
        </h1>
        <p className="max-w-xl text-foreground-muted">
          Group cards by purpose — a deck idea, an artist study, a gift list. A card can live in
          any number of decks and in your saves at the same time.
        </p>
      </header>

      <form action={createDeck} className="flex w-full max-w-md gap-3">
        <input
          type="text"
          name="name"
          required
          maxLength={DECK_NAME_MAX}
          placeholder="Name a new deck…"
          aria-label="New deck name"
          data-testid="deck-create-name"
          className="min-w-0 flex-1 rounded-pill border border-border-strong bg-surface px-5 py-2.5 text-foreground focus:border-foreground-subtle"
        />
        <Button type="submit" variant="primary" size="sm" data-testid="deck-create-submit">
          Create deck
        </Button>
      </form>

      {decks == null ? (
        <div className={cn(cardVariants(), "p-8 text-foreground-muted")}>
          Deck storage is not provisioned on this deployment yet. See docs/auth-setup.md for the
          database setup.
        </div>
      ) : decks.length === 0 ? (
        <div className="flex flex-col gap-1 border-t border-border pt-6" data-testid="decks-empty">
          <h2 className="font-display text-lg font-bold text-foreground">No decks yet</h2>
          <p className="max-w-sm text-foreground-muted">
            Create one above, or use “+ Deck” on any card in{" "}
            <Link href="/search" className="underline underline-offset-4 hover:text-foreground">
              search
            </Link>{" "}
            and{" "}
            <Link href="/saves" className="underline underline-offset-4 hover:text-foreground">
              saves
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="border-t border-border" data-testid="deck-list">
          {decks.map(deck => (
            <li key={deck.id} className="border-b border-border">
              <Link
                href={`/decks/${deck.id}`}
                data-testid={`deck-link-${deck.id}`}
                className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-surface-muted"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium text-foreground group-hover:underline group-hover:underline-offset-4">
                    {deck.name}
                  </span>
                  <span className="text-xs text-foreground-subtle">
                    Updated {updatedFormat.format(deck.updatedAt)}
                  </span>
                </span>
                <Badge variant="soft" size="md" data-testid={`deck-count-${deck.id}`}>
                  {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default DecksPage;
