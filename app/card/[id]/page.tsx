import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getOwnedQuantities } from "@/lib/collection";
import { addCardToCollection } from "@/lib/collection/actions";
import { getCardById } from "@/lib/pokemon";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import TypeBadge from "../../components/ui/TypeBadge";
import ArtZoom from "./ArtZoom";

interface CardPageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = async ({ params }: CardPageProps): Promise<Metadata> => {
  const { id } = await params;
  const card = await getCardById(id).catch(() => null);
  if (card == null) {
    return { title: "Card not found" };
  }
  const artistPart = card.artist != null ? ` Illustrated by ${card.artist}.` : "";
  return {
    title: `${card.name} · ${card.set.name} ${card.number}`,
    description: `${card.name} from ${card.set.name} (${card.set.series}).${artistPart} View the art in high resolution on TCG-Art.`,
    openGraph: {
      images: [{ url: card.images.large, width: 734, height: 1024, alt: `${card.name} card art` }],
    },
  };
};

// One field row of the metadata ledger; null values render nothing so the list
// stays honest instead of showing empty labels.
const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[7rem_1fr] gap-x-4 border-b border-border py-3 text-sm">
    <dt className="text-foreground-subtle">{label}</dt>
    <dd className="text-foreground">{children}</dd>
  </div>
);

// Card detail: the art as the biggest thing on the page (with zoom), the full
// metadata as a hairline ledger, and the artist as a first-class link into an
// artist-filtered search.
const CardDetailPage = async ({ params }: CardPageProps) => {
  const { id } = await params;
  const card = await getCardById(id);
  if (card == null) notFound();

  const user = await getSessionUser();
  const owned = user != null ? (await getOwnedQuantities(user.id)).get(card.id) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-gutter py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-foreground-subtle">
        <Link href="/search" className="underline underline-offset-4 transition-colors hover:text-foreground">
          Search
        </Link>{" "}
        / {card.set.name} · {card.number}
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
        <ArtZoom name={card.name} imageLarge={card.images.large} />

        <div className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-title font-bold tracking-tight text-foreground">
              {card.name}
            </h1>
            {card.flavorText != null ? (
              <p className="max-w-prose border-l-2 border-border pl-4 text-lead font-light text-foreground-muted">
                &ldquo;{card.flavorText}&rdquo;
              </p>
            ) : null}
          </div>

          <dl className="border-t border-border" data-testid="card-meta">
            <MetaRow label="Set">
              {card.set.name} <span className="text-foreground-subtle">({card.set.series})</span>
            </MetaRow>
            <MetaRow label="Number">
              <span className="tnum">{card.number}</span>
            </MetaRow>
            {card.rarity != null ? <MetaRow label="Rarity">{card.rarity}</MetaRow> : null}
            {card.supertype != null ? (
              <MetaRow label="Type">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{[card.supertype, ...card.subtypes].join(" · ")}</span>
                  {/* Energy types speak in their own color; everything else in
                      the ledger stays neutral. */}
                  {card.types.map(type => (
                    <TypeBadge key={type} type={type} />
                  ))}
                </span>
              </MetaRow>
            ) : null}
            {card.hp != null ? (
              <MetaRow label="HP">
                <span className="tnum">{card.hp}</span>
              </MetaRow>
            ) : null}
            {card.releaseDate != null ? (
              <MetaRow label="Released">
                <span className="tnum">{card.releaseDate}</span>
              </MetaRow>
            ) : null}
            {card.artist != null ? (
              <MetaRow label="Illustrator">
                <Link
                  href={`/search?mode=artist&q=${encodeURIComponent(card.artist)}`}
                  className="underline underline-offset-4 transition-colors hover:text-primary"
                  data-testid="artist-link"
                >
                  {card.artist}
                </Link>
              </MetaRow>
            ) : null}
          </dl>

          {user != null ? (
            <div className="flex items-center gap-3">
              <form action={addCardToCollection}>
                <input type="hidden" name="cardId" value={card.id} />
                <Button type="submit" variant="primary" size="md" data-testid={`add-${card.id}`}>
                  {owned != null ? "+ Add another to binder" : "+ Add to binder"}
                </Button>
              </form>
              {owned != null ? (
                <Badge variant="solid" size="sm" data-testid={`owned-${card.id}`}>
                  ×{owned} in your binder
                </Badge>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-foreground-subtle">
              <Link href="/signup" className="underline underline-offset-4 transition-colors hover:text-foreground">
                Sign up free
              </Link>{" "}
              to save this card to your binder.
            </p>
          )}
        </div>
      </div>
    </main>
  );
};

export default CardDetailPage;
