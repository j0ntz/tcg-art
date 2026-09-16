// Merge game metadata (supertype, subtypes, types, nationalPokedexNumbers,
// set releaseDate) into the committed art-index snapshot so faceted
// filtering/sorting has attributes to work with. Metadata only: the vision
// fields (scene/subjects/mood/palette/...) are never touched, and no card is
// re-described.
//
// Source: the Pokemon TCG API's own dataset mirror
// (github.com/PokemonTCG/pokemon-tcg-data), fetched per set. Idempotent; safe
// to re-run after the index grows.
//
//   node scripts/enrich-card-metadata.mjs
//
// When a DATABASE_URL is configured, run `npx drizzle-kit migrate` first and
// re-import the snapshot (or re-run the index pipeline) so card_art_index
// picks up the same columns; this script only rewrites data/art-index.json.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(HERE, "..", "data", "art-index.json");
const DATA_BASE = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master";

const fetchJson = async url => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    if (attempt === 3) throw new Error(`${url} responded ${res.status}`);
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
  return null;
};

const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
const setIds = [...new Set(snapshot.entries.map(entry => entry.setId))].sort();
console.log(`${snapshot.entries.length} entries across ${setIds.length} sets`);

const sets = await fetchJson(`${DATA_BASE}/sets/en.json`);
const releaseDateBySet = new Map(sets.map(set => [set.id, set.releaseDate ?? null]));

const metaByCard = new Map();
for (const setId of setIds) {
  const cards = await fetchJson(`${DATA_BASE}/cards/en/${setId}.json`);
  if (cards == null) {
    console.warn(`no dataset file for set ${setId}; its cards stay unenriched`);
    continue;
  }
  for (const card of cards) {
    metaByCard.set(card.id, {
      supertype: card.supertype ?? null,
      subtypes: card.subtypes ?? [],
      types: card.types ?? [],
      nationalPokedexNumbers: card.nationalPokedexNumbers ?? [],
    });
  }
  process.stdout.write(`${setId} `);
}
console.log();

let enriched = 0;
let missing = 0;
for (const entry of snapshot.entries) {
  const meta = metaByCard.get(entry.cardId);
  if (meta == null) {
    missing++;
    entry.supertype ??= null;
    entry.subtypes ??= [];
    entry.types ??= [];
    entry.nationalPokedexNumbers ??= [];
  } else {
    Object.assign(entry, meta);
    enriched++;
  }
  entry.releaseDate = releaseDateBySet.get(entry.setId) ?? entry.releaseDate ?? null;
}

await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 1) + "\n");
console.log(`enriched ${enriched}, missing metadata for ${missing}; wrote ${SNAPSHOT_PATH}`);
