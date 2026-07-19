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

// The card detail page's superset of Card: full metadata for one card.
export interface CardDetail extends Card {
  supertype: string | null;
  subtypes: string[];
  hp: string | null;
  types: string[];
  flavorText: string | null;
  releaseDate: string | null;
}

// One page of search results plus the API's total, so the UI can paginate.
export interface CardPage {
  cards: Card[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface ApiCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  artist?: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  flavorText?: string;
  set: { id: string; name: string; series: string; releaseDate?: string };
  images: { small: string; large: string };
}

interface ApiListResponse {
  data: ApiCard[];
  totalCount: number;
}

interface ApiSingleResponse {
  data: ApiCard;
}

export const SEARCH_PAGE_SIZE = 24;

// Lucene control characters the API query syntax reserves. We strip them from user
// input so a stray character cannot break the query or inject operators.
const LUCENE_CONTROL = /[+\-!(){}[\]^"~*?:\\/]/g;

const sanitizePage = (page: number): number =>
  Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

async function fetchCardPage(params: URLSearchParams, revalidate: number): Promise<CardPage> {
  const res = await fetch(`${API_URL}?${params.toString()}`, {
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`Pokemon TCG API responded ${res.status}`);
  }
  const body: ApiListResponse = await res.json();
  return {
    cards: body.data.map(toCard),
    totalCount: body.totalCount,
    page: Number(params.get("page") ?? "1"),
    pageSize: SEARCH_PAGE_SIZE,
  };
}

export async function searchCards(rawQuery: string, page = 1): Promise<CardPage> {
  const query = rawQuery.trim();
  const safePage = sanitizePage(page);
  const empty: CardPage = { cards: [], totalCount: 0, page: safePage, pageSize: SEARCH_PAGE_SIZE };
  if (query.length === 0) {
    return empty;
  }

  const tokens = query
    .replace(LUCENE_CONTROL, " ")
    .split(/\s+/)
    .filter(token => token.length > 0);
  if (tokens.length === 0) {
    return empty;
  }

  // Wildcard-match every token against the card name, e.g. "surfing pikachu" -> name:*surfing* name:*pikachu*.
  const q = tokens.map(token => `name:*${token}*`).join(" ");
  const params = new URLSearchParams({
    q,
    page: String(safePage),
    pageSize: String(SEARCH_PAGE_SIZE),
    orderBy: "name",
    select: "id,name,number,rarity,artist,set,images",
  });
  return fetchCardPage(params, 3600);
}

// All cards credited to one illustrator, newest set first. Reached from the
// artist attribution link on the card detail page.
export async function searchCardsByArtist(rawArtist: string, page = 1): Promise<CardPage> {
  const artist = rawArtist.trim().replace(/"/g, "");
  const safePage = sanitizePage(page);
  if (artist.length === 0) {
    return { cards: [], totalCount: 0, page: safePage, pageSize: SEARCH_PAGE_SIZE };
  }

  const params = new URLSearchParams({
    q: `artist:"${artist}"`,
    page: String(safePage),
    pageSize: String(SEARCH_PAGE_SIZE),
    orderBy: "-set.releaseDate",
    select: "id,name,number,rarity,artist,set,images",
  });
  return fetchCardPage(params, 86400);
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

// Card ids as the API mints them: "<setId>-<number>", e.g. "base1-4", "swsh12pt5gg-GG35".
// Collection rows and action inputs are validated against this so a malformed id
// can never reach the Lucene query below.
export const CARD_ID_PATTERN = /^[a-zA-Z0-9]+-[a-zA-Z0-9]+$/;

// Full metadata for one card (the /card/[id] detail page). Returns null for an
// id the API does not know, which the page maps to a 404.
export async function getCardById(rawId: string): Promise<CardDetail | null> {
  const id = rawId.trim();
  if (!CARD_ID_PATTERN.test(id)) {
    return null;
  }

  const res = await fetch(`${API_URL}/${encodeURIComponent(id)}`, {
    next: { revalidate: 86400 },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Pokemon TCG API responded ${res.status}`);
  }

  const body: ApiSingleResponse = await res.json();
  const card = body.data;
  return {
    ...toCard(card),
    supertype: card.supertype ?? null,
    subtypes: card.subtypes ?? [],
    hp: card.hp ?? null,
    types: card.types ?? [],
    flavorText: card.flavorText ?? null,
    releaseDate: card.set.releaseDate ?? null,
  };
}

// The API caps pageSize at 250; chunking at 50 also keeps each query string short.
const IDS_PER_REQUEST = 50;

async function fetchCardsByIdChunk(ids: string[]): Promise<Card[]> {
  // Quote each id so its hyphen is not parsed as a Lucene operator.
  const q = ids.map(id => `id:"${id}"`).join(" OR ");
  const params = new URLSearchParams({
    q,
    pageSize: String(IDS_PER_REQUEST),
    select: "id,name,number,rarity,artist,set,images",
  });

  const res = await fetch(`${API_URL}?${params.toString()}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`Pokemon TCG API responded ${res.status}`);
  }

  const body: ApiListResponse = await res.json();
  return body.data.map(toCard);
}

// Batch-resolve stored card ids to display data (the /binder page). Returned
// order is the API's, not the input's; callers re-order by mapping over their
// own id list. Ids the API no longer knows are simply absent from the result.
export async function getCardsByIds(rawIds: string[]): Promise<Map<string, Card>> {
  const ids = [...new Set(rawIds)].filter(id => CARD_ID_PATTERN.test(id));
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    chunks.push(ids.slice(i, i + IDS_PER_REQUEST));
  }
  const results = await Promise.all(chunks.map(fetchCardsByIdChunk));
  return new Map(results.flat().map(card => [card.id, card]));
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

  const body: ApiListResponse = await res.json();
  return body.data.slice(0, count).map(toCard);
}
