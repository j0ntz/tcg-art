import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getCollectionItems } from "@/lib/collection";
import { getCardsByIds } from "@/lib/pokemon";
import { cn } from "@/lib/utils";
import Badge from "../components/ui/Badge";
import { buttonVariants } from "../components/ui/Button";
import { cardVariants } from "../components/ui/Card";
import BinderView from "../components/binder/BinderView";
import { isDisplayMode, type BinderEntry, type DisplayMode } from "../components/binder/types";

export const metadata: Metadata = {
  title: "Your Binder — TCG-Art",
  description: "Your card collection, three ways: binder pages, carousel, night gallery.",
};

interface BinderPageProps {
  searchParams: Promise<{ mode?: string }>;
}

const acquiredFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Auth-gated collection dashboard (same server-side session gate as /account:
// no session, no page). Card display data is resolved fresh from the Pokemon
// TCG API; only card ids live in our database.
const BinderPage = async ({ searchParams }: BinderPageProps) => {
  const user = await getSessionUser();
  if (user == null) redirect("/login");

  const { mode } = await searchParams;
  const initialMode: DisplayMode = isDisplayMode(mode) ? mode : "binder";

  const items = await getCollectionItems(user.id);

  let entries: BinderEntry[] = [];
  let cardLookupError: string | null = null;
  if (items != null && items.length > 0) {
    try {
      const cardsById = await getCardsByIds(items.map(item => item.cardId));
      entries = items.flatMap(item => {
        const card = cardsById.get(item.cardId);
        if (card == null) return [];
        return [
          {
            card,
            quantity: item.quantity,
            acquiredLabel: acquiredFormat.format(item.acquiredAt),
          },
        ];
      });
    } catch (e: unknown) {
      cardLookupError = e instanceof Error ? e.message : "Card lookup failed";
    }
  }

  const totalCards = (items ?? []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-gutter py-10">
      <header className="flex flex-col gap-3">
        <Badge variant="soft">Your Collection</Badge>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-heading font-bold leading-tight tracking-tight text-foreground">
            Your Binder
          </h1>
          {items != null && items.length > 0 ? (
            <p className="text-sm text-foreground-subtle" data-testid="binder-count">
              {items.length} {items.length === 1 ? "card" : "cards"}
              {totalCards !== items.length ? ` · ${totalCards} copies` : ""}
            </p>
          ) : null}
        </div>
      </header>

      {items == null ? (
        <div className={cn(cardVariants(), "p-8 text-foreground-muted")}>
          Collection storage is not provisioned on this deployment yet. See docs/auth-setup.md
          for the database setup.
        </div>
      ) : items.length === 0 ? (
        <div
          className={cn(cardVariants(), "flex flex-col items-center gap-4 p-10 text-center sm:p-16")}
          data-testid="binder-empty"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-primary-muted text-3xl">
            🗂️
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">Your binder is empty</h2>
            <p className="max-w-sm text-foreground-muted">
              Find cards you love and add them straight from the search results. They will show
              up here in all three display modes.
            </p>
          </div>
          <Link href="/search" className={buttonVariants({ variant: "gradient", size: "md" })}>
            Search cards
          </Link>
        </div>
      ) : cardLookupError != null ? (
        <div className={cn(cardVariants(), "p-8")}>
          <p className="text-danger">
            Could not load card data right now: {cardLookupError}. Your {items.length} saved{" "}
            {items.length === 1 ? "card is" : "cards are"} safe; reload to try again.
          </p>
        </div>
      ) : (
        <BinderView entries={entries} initialMode={initialMode} />
      )}
    </main>
  );
};

export default BinderPage;
