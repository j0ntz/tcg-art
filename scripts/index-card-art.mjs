// Offline, resumable semantic-art indexing pipeline.
//
// For each target card (curated sets + name queries below), produce a
// structured description of the ART and store it twice:
//   1. Postgres `card_art_index` (DATABASE_URL if set, else the dev PGlite
//      under .pglite/ — stop `next dev` first, PGlite is single-process), and
//   2. the committed snapshot data/art-index.json, which is what zero-env
//      deployments (today's Vercel previews/production) search against.
//
// Describers:
//   - REAL (default when ANTHROPIC_API_KEY is set): claude-haiku-4-5 vision on
//     the card's small image. This is the product path.
//   - STUB (--stub, or automatic with a loud warning when no key exists):
//     metadata-only rows (name, TCG types, subtypes, flavor text) marked
//     model=stub-metadata-v1. Honest placeholder so the retrieval layer and
//     e2e suite stay fully exercisable without a key.
//
// Idempotent + resumable: rows whose model already equals the current target
// are skipped, so re-running continues where the last run stopped; real mode
// re-indexes (upgrades) stub rows. Progress checkpoints the snapshot every
// CHECKPOINT_EVERY cards, so a killed run loses at most one batch.
//
// Usage:
//   node scripts/index-card-art.mjs                  # index default sets
//   node scripts/index-card-art.mjs --stub           # force metadata stub rows
//   node scripts/index-card-art.mjs --estimate-only  # print card count + cost, no calls
//   node scripts/index-card-art.mjs --sets=base1,fossil --limit=50 --no-db
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SNAPSHOT_PATH = join(ROOT, "data", "art-index.json");

const TCG_API = "https://api.pokemontcg.io/v2/cards";
const HAIKU_MODEL = "claude-haiku-4-5";
const STUB_MODEL = "stub-metadata-v1";

// MVP scope: the classic Base-era sets (the most-collected cards, and the home
// of the known-answer e2e cases) plus Scarlet & Violet 151 for modern
// full-scene illustration art. Extend this list and re-run to grow the index.
// pokemontcg.io set ids: base1=Base, base2=Jungle, base3=Fossil, base4=Base Set 2.
const DEFAULT_SETS = ["base1", "base2", "base3", "base4", "neo1", "sv3pt5"];
// Cards that must be present regardless of set scope (e2e known answers).
const NAME_QUERIES = ["surfing pikachu", "flying pikachu"];

const CONCURRENCY = 6;
const CHECKPOINT_EVERY = 25;
// Haiku 4.5 pricing (USD per million tokens), for the cost report.
const PRICE_IN = 1.0;
const PRICE_OUT = 5.0;

const args = process.argv.slice(2);
const hasFlag = name => args.includes(`--${name}`);
const flagValue = name => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg == null ? null : arg.slice(name.length + 3);
};

const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
const useStub = hasFlag("stub") || apiKey === "";
const targetModel = useStub ? STUB_MODEL : HAIKU_MODEL;
const estimateOnly = hasFlag("estimate-only");
const skipDb = hasFlag("no-db");
const limit = flagValue("limit") != null ? Number(flagValue("limit")) : Infinity;
const sets = flagValue("sets") != null ? flagValue("sets").split(",") : DEFAULT_SETS;

if (useStub && !hasFlag("stub")) {
  console.warn(
    "WARNING: ANTHROPIC_API_KEY is not set; producing metadata-only STUB rows " +
      `(model=${STUB_MODEL}). Set the key and re-run to upgrade them to real ` +
      "Haiku vision descriptions.",
  );
}

// ---------- Pokemon TCG API ----------

const SELECT = "id,name,number,rarity,artist,set,images,types,subtypes,flavorText";

const fetchJson = async (url, init, attempts = 3) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      return await res.json();
    } catch (e) {
      if (e.fatal || attempt >= attempts) throw e;
      const backoff = 1500 * attempt;
      console.warn(`retry ${attempt}/${attempts} after error: ${e.message} (${backoff}ms)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
};

const fetchAllPages = async q => {
  const cards = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ q, page: String(page), pageSize: "250", select: SELECT });
    const body = await fetchJson(`${TCG_API}?${params}`);
    cards.push(...body.data);
    if (body.data.length < 250) return cards;
  }
};

const collectTargetCards = async () => {
  const byId = new Map();
  for (const setId of sets) {
    const cards = await fetchAllPages(`set.id:${setId}`);
    console.log(`set ${setId}: ${cards.length} cards`);
    for (const card of cards) byId.set(card.id, card);
  }
  for (const name of NAME_QUERIES) {
    const q = name
      .split(/\s+/)
      .map(token => `name:*${token}*`)
      .join(" ");
    const cards = await fetchAllPages(q);
    console.log(`name query "${name}": ${cards.length} cards`);
    for (const card of cards) byId.set(card.id, card);
  }
  return [...byId.values()];
};

// ---------- Describers ----------

const DESCRIBE_SYSTEM = `You describe the ILLUSTRATION of a trading card for a semantic art-search index.
Look only at the artwork: ignore the card frame, name text, HP, attack text, and symbols.
Return ONLY a JSON object (no prose) with:
- "scene": 1-2 sentences describing what the art depicts
- "subjects": array of lowercase nouns for the creatures/objects depicted (include the species name)
- "action": short lowercase phrase for what the subject is doing, or null
- "mood": array of lowercase emotional-tone words (2-4)
- "palette": array of lowercase dominant color words (2-4)
- "setting": short lowercase phrase for the environment, or null
- "style": short lowercase phrase for the art style`;

const usage = { in: 0, out: 0, calls: 0 };

const describeWithHaiku = async card => {
  const imageUrl = card.images.small;
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`image fetch ${imageRes.status} for ${card.id}`);
  const imageB64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64");
  const mediaType = imageUrl.endsWith(".jpg") || imageUrl.endsWith(".jpeg") ? "image/jpeg" : "image/png";

  const body = await fetchJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 500,
        system: DESCRIBE_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
              { type: "text", text: `Card: ${card.name} (${card.set.name}). Describe the illustration.` },
            ],
          },
        ],
      }),
    },
    4,
  );

  usage.in += body.usage?.input_tokens ?? 0;
  usage.out += body.usage?.output_tokens ?? 0;
  usage.calls += 1;

  const text = body.content?.find(block => block.type === "text")?.text ?? "";
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error(`no JSON in response for ${card.id}`);
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

  const arr = v => (Array.isArray(v) ? v.filter(x => typeof x === "string").map(x => x.toLowerCase()) : []);
  const str = v => (typeof v === "string" && v.trim() !== "" ? v : null);
  return {
    scene: str(parsed.scene) ?? `${card.name} card art.`,
    subjects: arr(parsed.subjects),
    action: str(parsed.action)?.toLowerCase() ?? null,
    mood: arr(parsed.mood),
    palette: arr(parsed.palette),
    setting: str(parsed.setting)?.toLowerCase() ?? null,
    style: str(parsed.style)?.toLowerCase() ?? null,
    model: HAIKU_MODEL,
  };
};

// Metadata-only stub: derives what it honestly can from the card record.
// Type hints give coarse palette/mood/setting signal (fire cards ARE mostly
// red/orange art); everything else stays empty rather than invented.
const TYPE_HINTS = {
  Fire: { palette: ["red", "orange", "flame"], mood: ["fierce"], setting: "volcanic" },
  Water: { palette: ["blue", "aqua"], mood: [], setting: "water" },
  Lightning: { palette: ["yellow"], mood: ["energetic"], setting: null },
  Grass: { palette: ["green"], mood: [], setting: "forest" },
  Psychic: { palette: ["purple"], mood: ["mysterious", "eerie"], setting: null },
  Fighting: { palette: ["brown"], mood: ["determined"], setting: null },
  Darkness: { palette: ["black", "dark"], mood: ["ominous", "eerie"], setting: "night" },
  Metal: { palette: ["silver", "gray"], mood: [], setting: null },
  Fairy: { palette: ["pink"], mood: ["whimsical"], setting: null },
  Dragon: { palette: ["gold"], mood: ["majestic"], setting: null },
  Colorless: { palette: [], mood: [], setting: null },
};

// Name decorations that are not part of the depicted species.
const NAME_NOISE = new Set([
  "ex", "gx", "v", "vmax", "vstar", "star", "prime", "dark", "light", "shining",
  "radiant", "galarian", "alolan", "hisuian", "paldean", "team", "rocket's",
  "brock's", "misty's", "erika's", "koga's", "giovanni's", "sabrina's",
  "lt.", "surge's", "blaine's",
]);

const describeFromMetadata = card => {
  const species = card.name
    .toLowerCase()
    .split(/\s+/)
    .filter(token => !NAME_NOISE.has(token))
    .join(" ");
  const types = card.types ?? [];
  const hints = types.map(type => TYPE_HINTS[type]).filter(Boolean);
  const flavor = card.flavorText ?? "";
  return {
    scene: flavor !== "" ? flavor : `${card.name} card art${card.artist ? ` by ${card.artist}` : ""}.`,
    subjects: [...new Set([species, ...types.map(type => type.toLowerCase())])],
    action: null,
    mood: [...new Set(hints.flatMap(hint => hint.mood))],
    palette: [...new Set(hints.flatMap(hint => hint.palette))],
    setting: hints.find(hint => hint.setting != null)?.setting ?? null,
    style: null,
    model: STUB_MODEL,
  };
};

const toEntry = (card, description) => {
  const searchText = [
    card.name,
    description.scene,
    description.subjects.join(" "),
    description.action ?? "",
    description.mood.join(" "),
    description.palette.join(" "),
    description.setting ?? "",
    description.style ?? "",
    (card.types ?? []).join(" "),
    (card.subtypes ?? []).join(" "),
    card.flavorText ?? "",
    card.rarity ?? "",
    card.artist ?? "",
    card.set.name,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return {
    cardId: card.id,
    name: card.name,
    setId: card.set.id,
    setName: card.set.name,
    number: card.number,
    rarity: card.rarity ?? null,
    artist: card.artist ?? null,
    imageSmall: card.images.small,
    imageLarge: card.images.large,
    scene: description.scene,
    subjects: description.subjects,
    action: description.action,
    mood: description.mood,
    palette: description.palette,
    setting: description.setting,
    style: description.style,
    searchText,
    model: description.model,
  };
};

// ---------- Storage ----------

const loadSnapshot = () => {
  if (!existsSync(SNAPSHOT_PATH)) return new Map();
  const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  return new Map(parsed.entries.map(entry => [entry.cardId, entry]));
};

const writeSnapshot = entriesById => {
  const entries = [...entriesById.values()].sort((a, b) => a.cardId.localeCompare(b.cardId));
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 1)}\n`);
};

const openDb = async () => {
  if (skipDb) return null;
  const url = process.env.DATABASE_URL;
  if (url != null && url !== "") {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url });
    await migrate(drizzle(pool), { migrationsFolder: join(ROOT, "drizzle") });
    return { query: (text, params) => pool.query(text, params), close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(join(ROOT, ".pglite"));
  await migrate(drizzle(client), { migrationsFolder: join(ROOT, "drizzle") });
  return { query: (text, params) => client.query(text, params), close: () => client.close() };
};

const UPSERT_SQL = `
INSERT INTO "card_art_index"
  ("cardId","name","setId","setName","number","rarity","artist","imageSmall","imageLarge",
   "scene","subjects","action","mood","palette","setting","style","searchText","model","indexedAt")
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
ON CONFLICT ("cardId") DO UPDATE SET
  "name"=excluded."name","setId"=excluded."setId","setName"=excluded."setName",
  "number"=excluded."number","rarity"=excluded."rarity","artist"=excluded."artist",
  "imageSmall"=excluded."imageSmall","imageLarge"=excluded."imageLarge",
  "scene"=excluded."scene","subjects"=excluded."subjects","action"=excluded."action",
  "mood"=excluded."mood","palette"=excluded."palette","setting"=excluded."setting",
  "style"=excluded."style","searchText"=excluded."searchText","model"=excluded."model",
  "indexedAt"=now()`;

const upsertEntry = (db, entry) =>
  db.query(UPSERT_SQL, [
    entry.cardId, entry.name, entry.setId, entry.setName, entry.number, entry.rarity,
    entry.artist, entry.imageSmall, entry.imageLarge, entry.scene,
    JSON.stringify(entry.subjects), entry.action, JSON.stringify(entry.mood),
    JSON.stringify(entry.palette), entry.setting, entry.style, entry.searchText, entry.model,
  ]);

// ---------- Main ----------

const run = async () => {
  console.log(`mode: ${useStub ? "STUB (metadata-only)" : `REAL (${HAIKU_MODEL} vision)`}`);
  const targets = await collectTargetCards();
  const existing = loadSnapshot();
  const pending = targets.filter(card => existing.get(card.id)?.model !== targetModel).slice(0, limit);
  console.log(`${targets.length} target cards, ${existing.size} already in snapshot, ${pending.length} to index`);

  // Pre-run cost estimate (real mode): small images are ~112 tokens
  // (245x342 / 750), prompts ~380, output ~320.
  if (!useStub || estimateOnly) {
    const estIn = pending.length * (112 + 380);
    const estOut = pending.length * 320;
    const estCost = (estIn / 1e6) * PRICE_IN + (estOut / 1e6) * PRICE_OUT;
    console.log(
      `estimated Haiku cost for ${pending.length} cards: ~${estIn.toLocaleString()} in / ` +
        `~${estOut.toLocaleString()} out tokens ≈ $${estCost.toFixed(2)}`,
    );
  }
  if (estimateOnly) return;
  if (pending.length === 0) {
    console.log("nothing to do");
    writeSnapshot(existing);
    return;
  }

  const db = await openDb();
  if (db != null) {
    // Sync any snapshot rows the database is missing (e.g. a fresh clone).
    for (const entry of existing.values()) await upsertEntry(db, entry);
  }

  let done = 0;
  let failed = 0;
  const queue = [...pending];
  const worker = async () => {
    for (;;) {
      const card = queue.shift();
      if (card == null) return;
      try {
        const description = useStub ? describeFromMetadata(card) : await describeWithHaiku(card);
        const entry = toEntry(card, description);
        existing.set(entry.cardId, entry);
        if (db != null) await upsertEntry(db, entry);
        done += 1;
        if (done % CHECKPOINT_EVERY === 0) {
          writeSnapshot(existing);
          console.log(`progress: ${done}/${pending.length} (checkpoint written)`);
        }
      } catch (e) {
        failed += 1;
        console.error(`FAILED ${card.id} (${card.name}): ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: useStub ? 1 : CONCURRENCY }, worker));

  writeSnapshot(existing);
  if (db != null) await db.close();

  console.log(`indexed ${done}/${pending.length} cards (${failed} failed; re-run to retry failures)`);
  console.log(`snapshot: ${SNAPSHOT_PATH} (${existing.size} total entries)`);
  if (!useStub) {
    const cost = (usage.in / 1e6) * PRICE_IN + (usage.out / 1e6) * PRICE_OUT;
    console.log(
      `actual usage: ${usage.calls} calls, ${usage.in.toLocaleString()} in / ` +
        `${usage.out.toLocaleString()} out tokens = $${cost.toFixed(2)}`,
    );
  }
  if (failed > 0) process.exitCode = 1;
};

run().catch(e => {
  console.error(e);
  process.exit(1);
});
