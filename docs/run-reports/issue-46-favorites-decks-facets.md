<!-- orch -->
# Agent run report: favorites + decks + faceted filters/sorts (binder retired)

**▶ Live preview: https://tcg-r4w8dlurq-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/49**

| field | value |
|---|---|
| Task | #46 · https://github.com/j0ntz/tcg-art/issues/46 |
| PR | https://github.com/j0ntz/tcg-art/pull/49 |
| Preview | https://tcg-r4w8dlurq-jontz.vercel.app |
| Branch | jon/task-46 |
| Verified | pass (`verify-preview.sh 49`, HTTP 200, mobile overflowBy 0) |
| Date | 2026-07-19 |

## Summary

The binder ownership model is retired and replaced with a favorites + decks
logged-in experience, and every card surface (search, saves, deck views) gains
convention-following faceted filters and sorts over the full attribute set:
game metadata (category, type, rarity, set, artist) plus the vision attributes
(dominant color, mood). Filter/sort state is URL-encoded and back-button-safe,
desktop gets a facet rail, mobile a bottom-sheet panel. Migration 0003/0004
converts every owned card into a favorite and drops the collection table;
`/binder` permanently redirects to `/saves`.

## What shipped

1. **Favorites**: `favorite` table (userId, cardId, savedAt PK'd per pair);
   optimistic heart toggle (`FavoriteButton`) on search tiles, saves, deck
   views, and the card detail page; logged-out tiles show a sign-in heart.
2. **Decks**: `deck` + `deck_card` tables (FK cascade, no game rules in v1,
   schema commented for a later rules layer); create/rename/delete plus
   add/remove from any card surface via the `+ Deck` popover (`AddToDeckMenu`),
   including "new deck born holding this card"; card-count badges on the deck
   ledger. Every deck mutation re-checks ownership server-side; a foreign
   deck id 404s.
3. **Attribute enrichment**: `card_art_index` gains supertype, subtypes,
   types, nationalPokedexNumbers, releaseDate (migration + index script +
   `scripts/enrich-card-metadata.mjs` backfill from the PokemonTCG dataset,
   metadata only, no vision re-describe); `lib/pokemon.ts` selects the same
   fields on every API query.
4. **Faceted search** (`lib/facets`, one config module): facet groups with
   counts (counts computed against every OTHER group's selection, the standard
   convention), OR-within/AND-across groups, applied chips with one-tap remove
   and clear-all, one sort dropdown per surface (relevance/newest/oldest/dex/
   alphabetical/hue on search; recency default on saves/decks), debounced
   instant apply, URL-encoded state. Vision facets are stripped outside art
   mode so no chip ever filters nothing; name/artist mode filters API-side via
   Lucene clauses and sorts via the API's orderBy.
5. **Views**: uniform `CardGrid` everywhere; `FocusCarousel` retained as the
   saves/deck alternate view via `ViewToggle` (URL param, filters carry over);
   binder pages, components, and nav removed; `/binder` → 308 `/saves`.
6. **e2e** (`orchestration/playwright/saves-decks-flows.mjs`): signup, saves
   empty state, facet narrowing asserted against the advertised count, sort
   order verified element-by-element, URL cold-load state restore, favorite
   round-trip incl. unheart, full deck lifecycle, mobile bottom sheet, and
   logged-out gates; 13 desktop+mobile screenshots committed.

## Verification

Independent cold verification (verify agent, 2026-07-19):

- `verify-preview.sh 49 "Save it, deck it"` → RESULT=pass against
  https://tcg-r4w8dlurq-jontz.vercel.app (HTTP 200, saves/decks pitch rendered,
  mobile 390px overflowBy 0).
- Verifier screenshots (committed under `docs/screenshots/`):
  - Desktop: [issue-46-verify-home-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-46/docs/screenshots/issue-46-verify-home-desktop.png)
  - Mobile (390px): [issue-46-verify-home-mobile.png](https://github.com/j0ntz/tcg-art/blob/jon/task-46/docs/screenshots/issue-46-verify-home-mobile.png)
  - Live faceted search (`/search?q=charizard&type=Fire&sort=az`): [issue-46-verify-search-facets.png](https://github.com/j0ntz/tcg-art/blob/jon/task-46/docs/screenshots/issue-46-verify-search-facets.png)
    — rail with per-group counts, Fire chip + clear-all, sort dropdown on
    Alphabetical, result count (22) exactly matching the facet's advertised
    count.
- Preview route probes: `/search?q=charizard&mode=name` 200 (filters + sort
  markup, sign-in hearts on tiles), `/search?mode=art&q=dragon&color=red` 200,
  `/saves` and `/decks` stream their metadata then redirect logged-out users
  to `/login`, `/binder` follows the permanent redirect onto the saves page.
- `tsc --noEmit`: clean on the branch.
- Cold diff review: no change requests. Deck/favorite server actions validate
  card ids against `CARD_ID_PATTERN` and re-check deck ownership on every
  mutation; migrations preserve prior collection rows as favorites before
  dropping the table; web TS standards hold (no `any`, `catch (e: unknown)`,
  `??` defaults, effect cleanups in FacetControls/AddToDeckMenu/FocusCarousel,
  required list keys); facet + sort definitions live in the single
  `lib/facets` config module per the task constraint. All 6 prior review
  threads (sort-state race, overhaul-screens port, vision-facet leak,
  artist-mode sort default, deck carousel zero-match state, duplicated title
  suffix) are fixed in 9a0aef9/8818398/150a50a and resolved.

Work-agent verification (original run): build green across three address
rounds; `saves-decks-flows.mjs` passed end to end with the 13 committed
screenshots listed in the PR.

## Decisions (yolo defaults)

_None._

## Notes & follow-ups

- Name/artist-mode facet options derive from the current result page (the API
  gives no cross-page aggregation), so counts are hidden there by design;
  art mode counts over the query's full ranked set.
- A URL hand-carrying a vision facet param into name mode keeps the inert
  param in the address bar until the next filter commit; it never renders a
  chip nor filters anything (e2e-asserted).
