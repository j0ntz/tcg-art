# Issue 31: Reward multi-attribute coverage over single-token frequency

Fixes multi-attribute query dilution in the semantic art search ranker. The production probe "tiny yellow bird in a snowstorm" returned Pidgeot/Fearow/Moltres because the single high-frequency token "bird" dominated; "yellow", "tiny", and "snowstorm" barely moved rank. The fix makes a row matching MORE of a query's distinct attributes outrank a row matching one token very strongly.

## What changed

Pure deterministic ranking upgrade in the existing lexical path (`lib/art-search/`), no API calls at query time.

- **Concept model** (`scoring.ts`): the query is parsed into *concepts*, one per user word, each carrying its vocab expansions. A concept scores its single strongest field hit (max, not sum), so synonyms of one word never pile up into a fake coverage signal. Weights live in one `SCORING_CONFIG` object.
- **Weighted fields**, subjects-first: name 6, subjects 5, scene 2.8, action 3, mood 2.5, palette/setting 2, style 1.5, free text 1. `scene` is now its own scored field (previously only reachable through the catch-all free-text field).
- **Per-concept IDF damping**: a concept matching a large share of the index (generic "bird", "pokemon") is damped toward a floor, so a high-frequency token cannot dominate rank on frequency alone.
- **Coverage bonus**: each additional distinct concept a row matches multiplies its score (+55% per extra concept), so 3 attributes matched beats 1 attribute matched strongly.
- **Collision de-dup**: when the user types a word that is also another concept's vocab expansion (e.g. "shell" is both its own concept and an expansion of "turtle"), the expansion is dropped so one index word cannot cover two concepts and double-count coverage.
- **Canonicalization** (`vocab.ts`, data table not code): tiny/small, snowstorm/snow/blizzard, orange color family, big/large, breathing.

## Before / after (top 6, shipped lexical scorer, no API key)

Rankings are computed by the shipped `rankEntries` in lexical mode, identical to the no-env Vercel preview (the preview and the e2e both run key-absent). "Before" is the committed `HEAD` scorer; "after" is this branch.

### "tiny yellow bird in a snowstorm"  — the reported bug

| # | Before | After |
|---|---|---|
| 1 | **Pidgeot** (large brown bird) 13.3 | **Spearow** (small, yellow palette) 6.84 |
| 2 | Pidgeot 11.9 | Zapdos (yellow bird) 6.40 |
| 3 | Spearow 11.9 | Articuno (bird in ice/snow) 5.95 |
| 4 | Spearow 11.9 | Articuno 5.95 |
| 5 | **Fearow** (large brown bird) 11.2 | Spearow 5.91 |
| 6 | **Moltres** 10.5 | Natu (tiny yellow bird) 4.98 |

Before, the brown Pidgeot line and Moltres topped the list on the "bird" token alone. After, small and/or yellow birds lead; **Moltres and the large brown Pidgeot/Fearow lines drop out of the top results entirely** (the regression case asserts this "outranks" relationship, not just presence).

### "angry orange dragon breathing fire"  — must not regress

| # | Before | After |
|---|---|---|
| 1 | Charizard ex 27.95 | Charizard ex 25.20 |
| 2 | Charmeleon 24.45 | Charizard ex 25.20 |
| 3 | Charmander 21.35 | Charmeleon 25.20 |
| 4 | **Magmar** (not a dragon) 21.0 | Charizard ex 10.57 |
| 5 | **Magmar** 21.0 | Charizard 9.91 |
| 6 | **Nidorino** (not a dragon) 21.0 | Charizard 9.91 |

Charizard line stays top and actually tightens: rows covering all five attributes (angry/orange/dragon/breathing/fire) now clearly separate from partial matches, and the Magmar/Nidorino leakage the old sum produced is gone.

### "sad ghost on a train"  — graceful absence (no train art exists)

| # | Before | After |
|---|---|---|
| 1 | Haunter 12.7 | Gastly 3.04 |
| 2 | Haunter 12.7 | Gastly 3.04 |
| 3 | Haunter 10.95 | Gastly 3.04 |
| 4 | Gastly 9.2 | Gengar 3.04 |
| 5 | Gastly 9.2 | Gengar 3.04 |
| 6 | Gastly 9.2 | Haunter 3.04 |

"train" matches no card in the index; both before and after, the ghost line is the entire result set. No train-adjacent garbage appears. The uniform 3.04 after reflects the single matched concept ("ghost"); "sad" carries no signal in the current stub-free index.

### "blue turtle with a shell"  — pre-existing MUST, still green

| # | Before | After |
|---|---|---|
| 1 | Blastoise 11.2 | Shellder 5.56 |
| 2 | Blastoise 11.2 | Shuckle 5.56 |
| 3 | Blastoise ex 11.2 | Cloyster 5.37 |
| 4 | Squirtle 11.2 | Togetic 5.37 |
| 5 | Squirtle 11.2 | **Blastoise 5.19** |
| 6 | Wartortle 11.2 | Blastoise 5.19 |

Honest note: the query names two attributes, "turtle" AND "shell". The turtle rows tag "turtle" but not "shell"; the clam/shell rows tag "shell" but not "turtle" (index descriptions, not the ranker). Both are legitimate for a query naming both. The MUST (a Squirtle/Wartortle/Blastoise line in the top 5) stays green: Blastoise at #5, with a clear score gap to the shell rows above (no rows fall between 5.19 and 5.37, so the position is stable).

## e2e regression suite

`orchestration/playwright/art-search-flows.mjs` extended with the three production probes as MUST cases (q13 tiny yellow bird, q14 angry orange dragon, q15 sad ghost on a train), plus an "outranks" (`beats`) assertion so q13 fails if Moltres or a large brown bird ranks above the first small/yellow bird. All 8 pre-existing MUST cases and the nonsense/empty guardrails stay green; the 4 SOFT cases are unchanged.

Screenshots (desktop 1440px + mobile 390px) for every query including the new probes are captured by `BASE_URL=<preview> npm run art:flows` during verification, committed as `docs/screenshots/issue-27-q13*..q15*.jpg` (shared art-search suite filename scheme).

## Verification

- `next build --webpack` green; `tsc --noEmit` clean. (The worktree's `node_modules` is a symlink to the main checkout, which the default Turbopack builder rejects with "symlink points out of filesystem root"; Vercel builds fresh without the symlink. Webpack build confirms the code compiles for production.)
- Ranking latency: ~9 ms per query over the full 686-row index (50-run average, in-process JS scan). This is a ranking change only, no new services, no measurable p50 impact.
- Constraint check: no Anthropic API usage at query time or in tests; the index is untouched.

## Follow-ups

- The "blue turtle with a shell" ordering improves for free once real vision rows tag turtle shells as "shell"; no ranker change needed.
- IDF is computed per query over the in-memory index; if the index moves to Postgres at scale, precompute per-token document frequencies once per index build rather than per query.

## Independent verification (verify-code)

Cold verification against the real Vercel preview, not the author's local numbers.

| field | value |
|---|---|
| Task | #31 · https://github.com/j0ntz/tcg-art/issues/31 |
| PR | https://github.com/j0ntz/tcg-art/pull/32 |
| Preview | https://tcg-p8340p1ml-jontz.vercel.app |
| Branch | jon/task-31 |
| Verified | preview live (HTTP 200), all MUST cases green |
| Date | 2026-07-05 |

- `verify-preview.sh 32` → RESULT=pass (HTTP 200, mobile 390px no horizontal overflow).
- `BASE_URL=<preview> art:flows` API assertions: all 11 MUST cases HIT in `mode=lexical` (confirms no Anthropic API at query time), both guardrails return 0 results. The q13 outrank assertion passed live: `outranks:OK (Spearow@1 vs Pidgeot@11)`. The three new probes (q13 tiny yellow bird, q14 angry orange dragon, q15 sad ghost on a train) and all 8 pre-existing MUST cases are green.
- Before/after ranking tables above reproduced independently from the shipped `rankEntries` against `HEAD` and this branch: exact match (Pidgeot 13.3 → Spearow 6.84 for q13; Blastoise line intact at #5 for the turtle MUST).
- Ranking latency measured ~9-17 ms per query over the full 686-row index (single-digit-to-teens ms, no measurable p50 impact; ranking-only change, no new services).

The strict `waitUntil: "networkidle"` in the shared art-search screenshot harness does not settle against this preview (the results grid streams 24 card images from the pokemontcg.io CDN, so network never idles for 500 ms); that is pre-existing harness behavior unrelated to this PR's diff. The multi-attribute probe screenshots below were captured with a load + explicit image-settle wait instead.

### Probe screenshots (live preview)

- q13 "tiny yellow bird in a snowstorm": [desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-31/docs/screenshots/issue-27-q13-tiny-yellow-bird-snow.jpg) · [mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-31/docs/screenshots/issue-27-q13-tiny-yellow-bird-snow-mobile.jpg) — Spearow/Zapdos/Articuno lead; Pidgeot/Fearow/Moltres demoted far down.
- q14 "angry orange dragon breathing fire": [desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-31/docs/screenshots/issue-27-q14-angry-orange-dragon-fire.jpg) · [mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-31/docs/screenshots/issue-27-q14-angry-orange-dragon-fire-mobile.jpg) — Charizard line stays top.
- q15 "sad ghost on a train": [desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-31/docs/screenshots/issue-27-q15-sad-ghost-train.jpg) · [mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-31/docs/screenshots/issue-27-q15-sad-ghost-train-mobile.jpg) — ghost line only, no train-adjacent garbage.
