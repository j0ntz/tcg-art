# Semantic art search: design

The core product differentiator (issue #27): a user describes what is IN the card art ("sad ghost in the rain", "pikachu riding a wave") and gets the right cards, not name matches. Two halves: an offline indexing pipeline that describes card art with Haiku vision, and a query path that matches free text against that index.

## Architecture

```
offline                                   query time
-------                                   ----------
scripts/index-card-art.mjs                /search (server component)  /api/art-search (JSON)
  Pokemon TCG API (card lists)                        |
  claude-haiku-4-5 vision per card          lib/art-search/searchArt()
        |                                     1. tokenize + curated vocab expansion (lib/art-search/vocab.ts)
        v                                     2. Haiku query parse -> same tag space   [needs ANTHROPIC_API_KEY]
  card_art_index (Postgres, drizzle)          3. weighted field ranking, in process (scoring.ts)
  data/art-index.json (committed snapshot)    over: DB rows if a database is configured,
                                              else the committed snapshot
```

### Index storage: Postgres + committed snapshot

Rows live in `card_art_index` (migration `drizzle/0002_semantic-art-index.sql`, schema in `lib/db/schema.ts`): per card, the structured art description (`scene`, `subjects`, `action`, `mood`, `palette`, `setting`, `style`), a concatenated lowercase `searchText`, denormalized display fields (name/set/images, so results render without a TCG API round-trip), and `model` recording the describer that produced the row.

The pipeline also exports the same rows into `data/art-index.json`, which is committed and statically bundled into the build. Reason: today's Vercel deployments have **zero env vars** (no `DATABASE_URL`; the auth runbook's provisioning steps are still pending), so a DB-only index would make search dead on every preview and on production. The query path prefers live DB rows when a configured database has them (a re-index then needs no redeploy) and falls back to the snapshot otherwise. This is the same graceful-degradation pattern the auth stack established.

### Retrieval choice and rationale

The issue offered three options: pgvector embeddings, Haiku query-parsing into the tag space + lexical ranking, or a hybrid. Chosen: **Haiku query parse + weighted in-process lexical ranking, with a curated vocab bridge as the no-key floor.**

- **pgvector is not standable today.** There is no hosted Postgres (production serves 503 on `/api/auth/session`; nothing is provisioned), and standing one up requires a third-party account signup, which is exactly the class of human step this task must not block on. pgvector also does nothing for zero-env previews.
- **Embeddings without a new signup means a local OSS model** (e.g. transformers.js + MiniLM). Fine offline, but query-time needs the model ON Vercel serverless: ONNX native bindings plus a 20MB+ model in the lambda, a cold-start and bundling risk with no fallback if it breaks. Rejected for MVP; noted as the natural v2 upgrade once a hosted DB with pgvector exists (index-side embeddings can be backfilled by re-running the pipeline).
- **The chosen design degrades in layers** and never breaks:
  1. `ANTHROPIC_API_KEY` present: Haiku translates the query into the same structured tag space the index rows use (subjects/action/mood/palette/setting/style + expansions), so "gloomy specter in a downpour" reaches ghost/rain/melancholy rows with zero literal overlap. ~1s latency, ~$0.0004 per query.
  2. No key (today's previews): pure lexical ranking with a curated synonym/species vocab (`vocab.ts`) bridging everyday words to index vocabulary (ghost -> gastly/haunter/gengar/spectral, sad -> melancholy/gloomy, volcano -> lava/volcanic).
  - Both layers feed one scorer (`scoring.ts`, all knobs in `SCORING_CONFIG`): the query becomes a set of *concepts* (one per user word, carrying its vocab expansions and folded so plurals merge). Each concept scores its single strongest field hit (name 6, subjects 5, scene 2.8, action 3, mood 2.5, palette/setting 2, style 1.5, free text 1; expansions at 0.7 discount), so synonyms of one concept never pile up. Two multipliers make multi-attribute queries reward coverage over single-token frequency (issue #31): **per-concept IDF damping** pushes generic tokens that hit a large share of the index ("bird", "pokemon") toward a floor so they cannot dominate on frequency alone, and a **coverage bonus** (+55% per additional distinct concept a row matches) lifts a row matching 3 query attributes above one matching a single high-frequency attribute very strongly. In-process scoring over the whole index is single-digit ms at current scale and stays acceptable to ~20k rows; Postgres full-text/trigram (or pgvector) takes over when the index outgrows that or a hosted DB lands.
- A Haiku rerank of the top-k was considered and skipped for MVP: latency doubles and the known-answer suite passes without it. The seam exists (rerank would slot into `searchArt()` after `rankEntries`).

### Search UI

`/search` now defaults to semantic art mode ("Describe the Art"); the original exact-name search remains as the `?mode=name` fallback, toggleable in the UI. Results show `matched:` term chips so it is visible WHY a card ranked, which also makes the pixel verification honest. Add-to-binder actions are unchanged in both modes.

## Indexing pipeline

`node scripts/index-card-art.mjs` (alias `npm run art:index`). Resumable, idempotent, checkpointed:

- Card list: curated sets (`base1`, `base2` Jungle, `base3` Fossil, `base4` Base Set 2, `neo1`, `sv3pt5` 151) plus name queries that guarantee the e2e known answers (`surfing pikachu`, `flying pikachu`). 686 cards today; growing the index = extend `DEFAULT_SETS` (or `--sets=...`) and re-run.
- Rows whose `model` already equals the current target are skipped: re-runs index only new/failed cards. Real (Haiku) runs re-index rows produced by the stub describer, which is how stub rows get upgraded in place.
- Snapshot checkpoint every 25 cards; a killed run loses at most one batch. Failed cards are logged and retried on the next run. Concurrency 6 against the Anthropic API.
- Describers: `claude-haiku-4-5` vision over the card's small image (default when `ANTHROPIC_API_KEY` is set) or `--stub` metadata-only rows (name, TCG types, subtypes, flavor text; `model=stub-metadata-v1`). `--estimate-only` prints the card count and cost estimate without calling anything; `--limit`, `--no-db` for partial/dev runs.
- Postgres writes go to `DATABASE_URL` when set, else the dev PGlite under `.pglite/` (stop `next dev` first; PGlite is single-process). Migrations are applied by the script before writing.

## Index stats (current commit)

| Stat | Value |
|---|---|
| Cards indexed | 686 |
| Sets | Base, Jungle, Fossil, Base Set 2, Neo Genesis, 151 (+ Surfing/Flying Pikachu name queries) |
| Describer | `stub-metadata-v1` (no API key available on this machine; see issue #27 comment) |
| Snapshot size | ~580 KB pretty-printed JSON |

## Cost figures (Haiku 4.5: $1/MTok in, $5/MTok out)

Small card images (245x342) cost ~112 tokens each ((245*342)/750); prompt ~380 tokens; output ~320 tokens. Per card ≈ $0.0021.

| Scope | Cards | Est. tokens (in / out) | Est. cost |
|---|---|---|---|
| Current MVP set list | 686 | 0.34M / 0.22M | ~$1.44 |
| "Few thousand" MVP target | 3,000 | 1.5M / 0.96M | ~$6.28 |
| Full catalog | ~20,000 | 9.8M / 6.4M | ~$41.84 |

These are pre-run estimates (the estimate the issue requires before running the full index); the script reports **actual** token usage and dollar cost from API `usage` fields at the end of every real run. Query-time Haiku parsing costs ~$0.0004/query (~400 in / ~60 out).

## Setup / env

| Variable | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | `.env.local` (indexing machine) and Vercel Production + Preview | Haiku vision indexing (offline) and query-time semantic parsing. Without it, indexing falls back to stub rows and queries fall back to lexical ranking; nothing breaks. |
| `DATABASE_URL` | optional, per `docs/auth-setup.md` | When set, the pipeline writes and the app reads `card_art_index` there; otherwise dev uses PGlite and deployments use the committed snapshot. |

Human bring-up (once): create an Anthropic API key named `tcg-art-index`, set it as above, run `npm run art:index`, commit the refreshed `data/art-index.json`, redeploy. Stub rows upgrade to real vision rows automatically.

## Testing

`npm run art:flows` (`orchestration/playwright/art-search-flows.mjs`), against any `BASE_URL`: 12 realistic queries spanning scene/mood/color/action phrasings with tiered expectations (8 MUST known-answer cases that fail the run on a miss, 4 SOFT cases reported honestly), nonsense/empty-query guardrails, the name-mode fallback, and desktop + mobile screenshots of every results grid into `docs/screenshots/issue-27-*.jpg`.

## Known limitations (honest)

- The committed index is **metadata-derived stub rows** until a human provisions the API key: real scene/weather/style semantics ("in the rain", "watercolor") have little to no signal, and only coarse mood/palette (from TCG types) and species/flavor-text words rank. The MUST e2e cases were chosen to be answerable by an honest metadata index; they get strictly better under real vision rows.
- Species vocab in `vocab.ts` covers Gen-1-era families relevant to the current sets; it is a curated floor, not a taxonomy. The Haiku query-parse layer subsumes it when a key is present.
- One shared index for all users; no per-user signals or pagination beyond top-24.
