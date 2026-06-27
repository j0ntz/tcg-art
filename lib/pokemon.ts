// Thin client for the public Pokemon TCG API (https://pokemontcg.io/).
// No API key is used for Phase 0; the public rate limits are enough for local dev.

const API_URL = "https://api.pokemontcg.io/v2/cards";

export interface CardSet {
  id: string;
  name: string;
  series: string;
}

export interface Card {
  id: string;
  name: string;
  number: string;
  rarity: string | null;
  artist: string | null;
  set: CardSet;
  images: { small: string; large: string };
}

interface ApiCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  artist?: string;
  set: { id: string; name: string; series: string };
  images: { small: string; large: string };
}

interface ApiResponse {
  data: ApiCard[];
}

// Lucene control characters the API query syntax reserves. We strip them from user
// input so a stray character cannot break the query or inject operators.
const LUCENE_CONTROL = /[+\-!(){}[\]^"~*?:\\/]/g;

export async function searchCards(rawQuery: string): Promise<Card[]> {
  const query = rawQuery.trim();
  if (query.length === 0) {
    return [];
  }

  const tokens = query
    .replace(LUCENE_CONTROL, " ")
    .split(/\s+/)
    .filter(token => token.length > 0);
  if (tokens.length === 0) {
    return [];
  }

  // Wildcard-match every token against the card name, e.g. "surfing pikachu" -> name:*surfing* name:*pikachu*.
  const q = tokens.map(token => `name:*${token}*`).join(" ");
  const params = new URLSearchParams({
    q,
    pageSize: "24",
    orderBy: "name",
    select: "id,name,number,rarity,artist,set,images",
  });

  const res = await fetch(`${API_URL}?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Pokemon TCG API responded ${res.status}`);
  }

  const body: ApiResponse = await res.json();
  return body.data.map(toCard);
}

function toCard(card: ApiCard): Card {
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity ?? null,
    artist: card.artist ?? null,
    set: { id: card.set.id, name: card.set.name, series: card.set.series },
    images: card.images,
  };
}

// A small, curated set of visually striking cards used to illustrate the landing
// hero. Best-effort: callers should treat a thrown error (or empty result) as
// "render the hero without art" rather than a failure.
export async function getShowcaseCards(count = 5): Promise<Card[]> {
  const params = new URLSearchParams({
    // Full-art / illustration-rare cards have the strongest art, which is the
    // whole point of the product.
    q: 'name:charizard (rarity:"Illustration Rare" OR rarity:"Special Illustration Rare" OR rarity:"Rare Holo")',
    pageSize: String(count),
    orderBy: "-set.releaseDate",
    select: "id,name,number,rarity,artist,set,images",
  });

  const res = await fetch(`${API_URL}?${params.toString()}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`Pokemon TCG API responded ${res.status}`);
  }

  const body: ApiResponse = await res.json();
  return body.data.slice(0, count).map(toCard);
}
