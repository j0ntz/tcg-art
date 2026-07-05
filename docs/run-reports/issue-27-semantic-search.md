# Issue 27: Semantic art search MVP

**▶ Live preview: https://tcg-6r4evpj14-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/28**

| | |
|---|---|
| Preview | https://tcg-6r4evpj14-jontz.vercel.app |
| Try it | [/search?q=sad ghost in the rain](https://tcg-6r4evpj14-jontz.vercel.app/search?q=sad%20ghost%20in%20the%20rain) · [/search?q=pikachu riding a wave](https://tcg-6r4evpj14-jontz.vercel.app/search?q=pikachu%20riding%20a%20wave) |
| Design doc | [docs/semantic-search-design.md](../semantic-search-design.md) |

## What shipped

Semantic art search end to end: an offline resumable indexing pipeline (`scripts/index-card-art.mjs`, Haiku 4.5 vision per card) writing to Postgres `card_art_index` (migration 0002) and the committed `data/art-index.json` snapshot; a layered query path (`lib/art-search/`: Haiku query-parse into the index's tag space when `ANTHROPIC_API_KEY` exists, curated-vocab lexical ranking always); `/search` reworked to art-description-first with exact-name search as the `?mode=name` fallback; a JSON surface at `/api/art-search`; a 12-query tiered e2e suite with desktop+mobile pixel proofs.

686 cards indexed (Base, Jungle, Fossil, Base Set 2, Neo Genesis, 151, plus Surfing/Flying Pikachu). Cost estimates reported pre-run per the issue: ~$0.0021/card, ~$1.44 for the current set list, ~$42 for the full ~20k catalog (details in the design doc).

## The one human gate (posted as the single allowed comment)

No Anthropic API key exists anywhere on the operator machine, and the only connected Chrome is logged out of the Anthropic console, so the authorized in-browser key creation was impossible after real attempts ([issue comment](https://github.com/j0ntz/tcg-art/issues/27#issuecomment-4885360889) has the full audit). The committed index therefore uses the honest metadata-derived stub describer (`model=stub-metadata-v1`: card names, TCG types, subtypes, flavor text). Everything else is the real product path; running `npm run art:index` with a key upgrades every stub row to Haiku vision rows in place.

## Verification (against the live Vercel preview)

`BASE_URL=<preview> npm run art:flows`: all 8 MUST known-answer cases and all 4 SOFT cases hit, plus nonsense/empty-query guardrails and the name-mode fallback (24 charizard results). Full ranked outputs are printed by the script; screenshots for every query at desktop 1440px and mobile 390px are committed as `docs/screenshots/issue-27-q*.jpg`.

Pixel-verification honesty, per query (art visually matches the ask?):

| Query | Top results | Verdict |
|---|---|---|
| pikachu surfing / surfing pikachu / riding a wave | Surfing Pikachu x3 top-3 | HIT: literally pikachu on a surfboard on a wave |
| red dragon over a volcano | Dragonair/Dragonite/Dratini, Charizard #5 | PARTIAL: dragons rank above the red fire dragon; Charizard present top-5. Stub has no scene signal to know Dragonair's art is blue sea, not volcano |
| yellow electric mouse | Raichu x4, then Electabuzz, Pikachu | HIT: all yellow electric rodents (Electabuzz is yellow/electric but no mouse) |
| blue turtle with a shell | Blastoise/Squirtle top-5 | HIT |
| spooky purple ghost | Gastly x4, Gengar | HIT: purple ghost art throughout |
| sad ghost in the rain | all-ghost top-10 (Gastly/Gengar/Haunter) | PARTIAL: ghosts yes, "sad"/"rain" carry no stub signal; grid tail shows loose matches (Charmander via flavor-text "rain") |
| fiery flame bird | Moltres x2 top, fire types | HIT |
| mysterious psychic under the full moon | Mewtwo, Abra/Alakazam line | HIT (moon via Gengar/Clefairy flavor text ranks in top-24) |
| sleeping pokemon | Snorlax x3 top | HIT (low scores; flavor-text driven) |
| green bug in the forest | Pinsir, Caterpie, Kakuna, Metapod | HIT |

The PARTIAL rows are exactly the scene/weather semantics the stub cannot honestly provide; they are the rows that improve when the key lands and real vision rows replace the stubs.

- `npm run build` green; ESLint clean; `npm run binder:flows` full pass (binder flow pinned to `mode=name`).

## Decisions

- Retrieval: Haiku tag-space query parse + weighted in-process lexical ranking over pgvector/local embeddings; rationale and the v2 seams in the design doc.
- Index dual-stored (Postgres + committed snapshot) so zero-env deployments search; DB rows win when present.
- `/search` defaults to semantic mode; name search preserved as a mode, not removed.

## Gaps / follow-ups

- Human: provision `ANTHROPIC_API_KEY` (console key `tcg-art-index` -> `.env.local` + Vercel), re-run `npm run art:index`, commit the snapshot. Everything upgrades in place.
- Grow the index past 686 cards by extending `DEFAULT_SETS` (cost table in the design doc).
- Once a hosted Postgres exists: pgvector embeddings + Haiku rerank are the natural quality upgrades.
