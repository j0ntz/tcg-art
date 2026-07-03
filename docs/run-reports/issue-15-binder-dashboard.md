# Run report: issue #15, binder/portfolio dashboard (three display modes)

## Mode 3 ideation (/drunk-claude)

The issue required ideating the third display mode with the `/drunk-claude` skill. The skill was invoked (intensity 0.7, chaotic mood) and produced five candidates:

1. **The Night Gallery**: the collection hung as a museum exhibition (dark wall, spotlights, frames, artist placards).
2. **Pack-Rip Rewind**: re-experience the collection as swipe-through booster pack openings.
3. **The Constellation**: sets as constellations, owned cards as stars, missing cards as gaps.
4. **Wolf of Pallet Town**: the collection as a stock-portfolio trading desk with fake tickers.
5. **The Shrine**: a slot-machine lever that elevates one random card onto a pedestal.

**The Night Gallery won.** It is the only candidate that browses the whole collection (Constellation and Shrine surface single cards or gaps), needs no invented data (the portfolio idea runs on fake prices), is genuinely distinct from the other two modes (binder = inventory grid, carousel = single-card focus, gallery = ambient exhibition), and its centerpiece effects (dark wall, spotlight gradients, placards) are static CSS, so mobile and `prefers-reduced-motion` support cost nothing. It also foregrounds the illustrator, which fits an app named TCG-Art: the placard credits the artist on every piece, data the other modes de-emphasize.

## What was built

- **Data model** (`lib/db/schema.ts`, migration `drizzle/0001_binder-collection.sql`): `collection_item` table keyed on `(userId, cardId)` with `quantity` and `acquiredAt`, FK to the auth task's `user.id` with cascade delete. Only card ids are stored; display data resolves through `lib/pokemon.ts` at render time (`getCardsByIds`, chunked, quoted Lucene id query).
- **Server actions** (`lib/collection/actions.ts`): `addCardToCollection` (upsert; a second add increments `quantity`) and `removeCardFromCollection` (deletes the row). Plain-form friendly, session-gated, input validated against the card id pattern.
- **`/binder`** (`app/binder/page.tsx`): server-side session gate identical to `/account` (no session -> redirect to `/login`, which is the login prompt). Header with card/copy counts, degraded notice when no database is provisioned, error state when the card API is down, empty state pointing at `/search`.
- **Three display modes** (`app/components/binder/`), toggleable via a segmented control and deep-linkable via `?mode=`:
  - **Binder** (`BinderPages.tsx`): fixed 3x3 pocket sheets (empty pockets render as sleeves), spine rings, page-flip animation behind `motion-safe:`, prev/next paging, per-card quantity badge and remove button.
  - **Carousel** (`Carousel.tsx`): native scroll-snap strip (mobile swiping is platform-native), centered card scaled up via IntersectionObserver, placard with set/rarity/artist/acquired details, prev/next buttons that respect `prefers-reduced-motion` when scrolling.
  - **Night Gallery** (`NightGallery.tsx`): dark exhibition wall, per-piece spotlight pools, brand-gradient frame with white mat, museum placard crediting the illustrator. All decoration is static CSS; the only motion is a `motion-safe:` hover lift.
- **Add path** (`app/search/page.tsx`): logged-in searchers get an "+ Add to binder" button on every result plus an owned-count badge; logged-out search is unchanged.
- **Header**: a Binder link appears when logged in.

## What was verified end to end

Verification harness: `npm run binder:flows` (`orchestration/playwright/binder-flows.mjs`) against `next dev` (PGlite Postgres, real signup, real server actions). All checks passing:

1. Fresh signup -> `/binder` shows the empty state with a working link to search (issue-15-binder-empty.jpg, issue-15-binder-empty-mobile.jpg).
2. Add from search round-trips to the database: the owned badge appears only after the server action writes and the page re-renders from a fresh query (issue-15-search-add.jpg). 11 cards added.
3. Adding an already-owned card increments quantity (badge shows ×2) instead of duplicating the row.
4. Binder mode: header counts 11 cards / 12 copies, 11 cards paginate into 2 fixed 9-slot pages, page turn reaches page 2 (issue-15-mode-binder.jpg).
5. Carousel mode renders with the details placard; next advances the focused card (issue-15-mode-carousel.jpg).
6. Night gallery renders (issue-15-mode-gallery.jpg).
7. All three modes captured at 390x844 via `?mode=` deep links, which also proves URL mode seeding (issue-15-mode-binder-mobile.jpg, issue-15-mode-carousel-mobile.jpg, issue-15-mode-gallery-mobile.jpg).
8. Remove round-trips: count drops to 10 cards and the removed card disappears from the binder.
9. `/binder` while logged out server-side-redirects to `/login`.

Not exercised: production `DATABASE_URL` (node-postgres) path; it shares schema, migration, and query code with the verified PGlite path, differing only in the driver (same posture as the auth task).

## Notes for the verifier

- On a bare preview deployment (no auth env vars), `/binder` redirects to `/login`, which renders the degraded providers-disabled state from task 14. With auth but no database, `/binder` renders a "not provisioned" notice instead of crashing.
- Card adds revalidate `/search` and `/binder`; the re-rendered search page re-queries the Pokemon TCG API, which is occasionally slow (10-30s). The harness sets 120s waits for this reason.
- This branch is stacked on `jon/task-14` (issue #14 was not landed at build time); the collection table extends that task's schema rather than forking a parallel user model.
