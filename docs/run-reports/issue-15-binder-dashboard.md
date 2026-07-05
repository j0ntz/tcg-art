# Agent run report: binder/portfolio dashboard, three display modes

**▶ Live preview: https://tcg-e6lodm73i-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/22**

| field | value |
|---|---|
| Task | #15 · https://github.com/j0ntz/tcg-art/issues/15 |
| PR | https://github.com/j0ntz/tcg-art/pull/22 |
| Preview | https://tcg-e6lodm73i-jontz.vercel.app |
| Branch | jon/task-15 (stacked on jon/task-14, PR #21) |
| Verified | pass |
| Date | 2026-07-02 |

## Summary

A user-owned card collection (`collection_item` table extending the auth task's schema) with an auth-gated `/binder` dashboard that renders it in three toggleable, `?mode=` deep-linkable display modes: a 9-pocket physical-style binder, a scroll-snap art carousel, and the Night Gallery (the winning `/drunk-claude` idea). Cards are added from `/search` results and removed from the binder via plain-form server actions. Independently verified: the Vercel preview passes `verify-preview.sh`, and a cold re-run of the full Playwright harness proved the add/remove database round-trip and all three modes end to end.

## Mode 3 ideation (/drunk-claude)

The issue required ideating the third display mode with the `/drunk-claude` skill. The skill was invoked (intensity 0.7, chaotic mood) and produced five candidates:

1. **The Night Gallery**: the collection hung as a museum exhibition (dark wall, spotlights, frames, artist placards).
2. **Pack-Rip Rewind**: re-experience the collection as swipe-through booster pack openings.
3. **The Constellation**: sets as constellations, owned cards as stars, missing cards as gaps.
4. **Wolf of Pallet Town**: the collection as a stock-portfolio trading desk with fake tickers.
5. **The Shrine**: a slot-machine lever that elevates one random card onto a pedestal.

**The Night Gallery won.** It is the only candidate that browses the whole collection (Constellation and Shrine surface single cards or gaps), needs no invented data (the portfolio idea runs on fake prices), is genuinely distinct from the other two modes (binder = inventory grid, carousel = single-card focus, gallery = ambient exhibition), and its centerpiece effects (dark wall, spotlight gradients, placards) are static CSS, so mobile and `prefers-reduced-motion` support cost nothing. It also foregrounds the illustrator, which fits an app named TCG-Art: the placard credits the artist on every piece, data the other modes de-emphasize.

## What changed

- **Data model** (`lib/db/schema.ts`, migration `drizzle/0001_binder-collection.sql`): `collection_item` keyed on `(userId, cardId)` with `quantity` and `acquiredAt`, FK to the auth task's `user.id` with cascade delete. Only card ids are stored (never card blobs); display data resolves through `lib/pokemon.ts` at render time (`getCardsByIds`, chunked, quoted Lucene id query, ids validated against `CARD_ID_PATTERN`).
- **Server actions** (`lib/collection/actions.ts`): `addCardToCollection` (upsert; re-add increments `quantity` atomically) and `removeCardFromCollection`. Plain-form friendly, session-gated, input validated.
- **`/binder`** (`app/binder/page.tsx`): server-side session gate identical to `/account` (no session redirects to `/login`). Card/copy counts, empty state pointing at `/search`, degraded notice when no database is provisioned, error state when the card API is down.
- **Three display modes** (`app/components/binder/`): binder (fixed 3x3 pocket sheets, spine rings, `motion-safe:` page flip, paging), carousel (native scroll-snap, IntersectionObserver focus scaling, details placard, reduced-motion-aware scrolling), Night Gallery (static-CSS exhibition wall with artist placards).
- **Add path** (`app/search/page.tsx`): logged-in searchers get "+ Add to binder" with an owned-count badge on every result; logged-out search is unchanged.
- **Header**: a Binder link appears when logged in.

## Test evidence

### Independent verification (this report, fresh agent)

- `verify-preview.sh 22 "Log In"` → **pass** against https://tcg-e6lodm73i-jontz.vercel.app for head SHA `e3b90aa` (HTTP 200, mobile 390px overflowBy 0).
- Rendered-HTML probes on the live preview (no auth/db env vars, so degraded mode is the acceptance state, same posture as task #14):
  - `/binder` → 307 server redirect to `/login` (the auth gate holds logged out), and the login prompt renders.
  - `/binder?mode=gallery` → same 307 (deep links are gated too).
  - `/search?q=pikachu` logged out → no add buttons (logged-out search unchanged).
- Cold re-run of the full E2E harness (`npm run binder:flows` against `next dev` + PGlite): all 13 checks passed. Fresh signup, empty state, 11 adds from search where the owned badge appears only after the database write round-trips, re-add shows ×2 quantity, header counts 11 cards / 12 copies, two 9-slot binder pages with working page turn, carousel advance with placard, night gallery render, all three modes at 390x844 via `?mode=` deep links, remove round-trip (count drops, card gone), logged-out redirect.
- Preview screenshots (committed under `docs/screenshots/`, linked as blob URLs since the repo is private):
  - Desktop: [issue-15-preview-home-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-preview-home-desktop.png)
  - Mobile (~390px): [issue-15-preview-home-mobile.png](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-preview-home-mobile.png)

### Builder's end-to-end evidence (same harness, original run)

Screenshots committed under `docs/screenshots/`:

| | Binder | Carousel | Night Gallery |
|---|---|---|---|
| Desktop | [binder](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-mode-binder.jpg) | [carousel](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-mode-carousel.jpg) | [gallery](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-mode-gallery.jpg) |
| Mobile (390px) | [binder](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-mode-binder-mobile.jpg) | [carousel](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-mode-carousel-mobile.jpg) | [gallery](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-mode-gallery-mobile.jpg) |

Empty state: [desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-binder-empty.jpg) / [mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-binder-empty-mobile.jpg). Add path: [search-add](https://github.com/j0ntz/tcg-art/blob/jon/task-15/docs/screenshots/issue-15-search-add.jpg).

Not exercised: the production `DATABASE_URL` (node-postgres) path; it shares schema, migration, and query code with the verified PGlite path, differing only in the driver (same posture as the auth task).

## Decisions (yolo defaults)

- **Stacked on `jon/task-14`** (issue #14 not landed at build time), per the issue instructions: the collection table extends that task's schema and references its `user.id`; no second user representation. Lander sequences PR #21 first.
- **Remove deletes all copies** (one clear gesture on `/binder`) instead of per-copy decrement bookkeeping; re-add increments quantity. Reversible later with a quantity stepper.
- **Mode state via `window.history.replaceState`** (shallow, no navigation) seeded from the server-read `?mode=` param, so modes are deep-linkable without a client router round-trip.
- **Silent no-op on failed actions** (invalid card id, missing db) at this stage; the re-rendered page shows unchanged state. Documented in the action layer.

## Notes & follow-ups

- The preview deployment has no auth/database env vars, so cards-in-binder cannot be shown on the live preview itself; the accepted degraded behavior (gate redirect + disabled providers) matches task #14's verified posture. Full three-mode evidence comes from the real-Postgres (PGlite) E2E runs above, reproduced independently during verification.
- Credentials login on previews needs `AUTH_SECRET` + `DATABASE_URL` for the Preview environment, plus `npx drizzle-kit migrate` against that database (migrations `0000` and `0001`).
- Card adds revalidate `/search` and `/binder`; the re-rendered search page re-queries the Pokemon TCG API, which is occasionally slow (10-30s). The harness sets 120s waits for this reason.
