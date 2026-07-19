# Run report: issue #47 — site overhaul (anti-slop design system + gap closure)

Contract: `docs/research/anti-slop-ui.md`. Written system: `docs/design-system.md`
(new). Inherited by future agents via the "Design system" section added to
`CLAUDE.md`.

## What shipped

1. **Token system** (`app/globals.css`, rewritten)
   - Type: Fraunces (display) + IBM Plex Sans (body) via next/font, replacing
     the banned Geist pair. Scale ratio >= 1.25; `text-wrap: balance` on
     headings; `tnum` utility for tabular numbers.
   - Color: violet/indigo ramps deleted. One dominant (warm "ink" neutral
     ramp) + one accent ("ember" flame orange from the Charizard showcase
     art), all OKLCH, with the accent budgeted to 5 named placements
     documented in globals.css.
   - Radius scale: field 6px / card 12px / pill. Neutral-only shadows.
     4px spacing rhythm.
2. **Every surface restyled to the tokens**: landing (midnight-cinema hero
   kept, audited: glows, gradients, badge-kicker, gradient text, colored
   shadows all removed), How It Works and Build Your Binder re-set as the
   hairline-ledger primitive, pricing de-gradiented, header/footer wordmark
   (Fraunces, no gradient logo tile), search band + tight 5-column results
   grid (name/set/artist only), auth pages, binder (visual restyle only:
   kicker removed, emoji-icon empty state replaced with empty sleeves, Night
   Gallery flattened, radial glows and gradient frames removed).
   The Reveal scroll-stagger system was deleted; page-level motion is the one
   scroll-linked hero fan (reduced-motion gated).
3. **Functional gaps closed**
   - Card detail `/card/[id]`: high-res art with click-to-zoom lightbox
     (Escape/backdrop close, scroll lock), full metadata ledger, artist
     attribution linking to a new artist-filtered search
     (`/search?mode=artist`), add-to-binder for logged-in users, per-card
     OpenGraph metadata, unknown id -> 404. Search results, binder pages, and
     the Night Gallery now link to the detail page instead of raw image files.
   - States: `loading.tsx` skeletons for /search, /card/[id], /binder;
     designed no-query (real example queries) and no-results states; root
     `error.tsx` with retry; designed `not-found.tsx`.
   - Pagination: name and artist searches page through the full result set
     (Prev/Next + page N of M via the API totalCount); art mode gets a
     "Show more matches" deepening (24 -> 48 -> 96).
   - Accessibility: global `:focus-visible` ring; `outline-none` removed;
     card alt text; decorative hero fan `aria-hidden`; inverse text tiers
     chosen for contrast on the near-black stage.
   - SEO: `metadataBase` + title template + OpenGraph/Twitter card in the root
     layout, product OG image (`public/og.png`, captured from the live hero),
     per-card OG on detail pages.
   - `images.scrydex.com` added to image remotePatterns (newer sets' card
     images 500'd next/image on the artist/search surfaces without it).

## Vision self-review loop

Loop ran twice: full capture -> audit -> fixes -> full re-capture
(`orchestration/playwright/overhaul-screens.mjs`, new). Defects caught by the
loop and fixed in round 2: zoom lightbox rendered the art SMALLER than the
inline image (now fills 92vh); Next.js dev-tools badge polluting captures
(devIndicators disabled).

Final screenshot set (docs/screenshots/):

| Surface | Desktop 1440 | Mobile 390 |
| --- | --- | --- |
| Landing | issue-47-landing-desktop.png | issue-47-landing-mobile.png |
| Search, no query (empty state) | issue-47-search-empty-desktop.png | — |
| Search, art mode results | issue-47-search-art-desktop.png | issue-47-search-art-mobile.png |
| Search, name mode + pagination | issue-47-search-name-desktop.png | — |
| Search, no results state | issue-47-search-noresults-desktop.png | — |
| Search, artist mode | issue-47-search-artist-desktop.png | — |
| Card detail | issue-47-card-detail-desktop.png | issue-47-card-detail-mobile.png |
| Card zoom lightbox | issue-47-card-zoom-desktop.png | — |
| 404 | issue-47-notfound-desktop.png | — |
| Log in / Sign up | issue-47-login-desktop.png, issue-47-signup-desktop.png | issue-47-signup-mobile.png |
| Binder empty state | issue-47-binder-empty-desktop.png | — |
| Binder (sheet) | issue-47-binder-desktop.png | — |
| Night Gallery | issue-47-binder-gallery-desktop.png | issue-47-binder-gallery-mobile.png |

## Anti-slop self-audit (banned pattern -> status)

| Banned pattern | Status |
| --- | --- |
| Inter/Roboto/Open Sans/Lato/Arial/system/Space Grotesk/Geist | ABSENT — Fraunces + IBM Plex Sans only (Geist removed this PR) |
| Purple/indigo/violet defaults | ABSENT — ramps deleted from globals.css |
| Purple-cyan gradients / gradient text / gradient buttons | ABSENT — all `bg-gradient-*` and the brand-gradient utility removed |
| Gradient blobs / glows | ABSENT — hero glow divs and Night Gallery radial "lighting" removed; stages are flat ink-950 |
| Colored box-shadows | ABSENT — fan shadow now neutral `shadow-float`; shadow tokens are black alphas |
| Cyan-on-dark | ABSENT |
| Pure #000 text | ABSENT — darkest text is ink-900 (oklch 21.4%) |
| Uniform radius everywhere | ABSENT — 6/12/pill scale; card images 6px, panels 12px |
| Thick colored border on one card edge | ABSENT — pricing highlight is a neutral border+lift |
| Icon-on-top feature-card grids | ABSENT — features are hairline ledger rows |
| Three-box rounded hero grids | ABSENT |
| 01/02/03 decorative eyebrows | ABSENT — steps are a semantic <ol> with plain 1/2/3 in quiet tabular text |
| ALL-CAPS letter-spaced kickers | ABSENT — Night Gallery caps header replaced |
| Badge/kicker above hero H1 | ABSENT — hero and binder badges removed |
| Stat banners / fake testimonials | ABSENT |
| Emoji-as-icons | ABSENT — binder empty-state emoji replaced with empty sleeves |
| Cards-in-cards / glassmorphism | ABSENT — Build Your Binder glass panels replaced with ledger rows |
| Centered-everything | ABSENT at page level — sections left-aligned; auth/empty panels center within a single card deliberately |
| Stagger-everything-on-load / bounce easing / transition:all | ABSENT — Reveal system deleted; remaining motion is interaction-tied or the single scroll-linked fan |
| Glow affordances | ABSENT |
| Lorem ipsum / placeholder content | ABSENT — screenshots use live API data and a real signup |
| outline:none without :focus-visible | ABSENT — global :focus-visible ring; outline-none instances removed |

## Verification

- `npm run build`: green (Turbopack + TypeScript). `npm run lint`: clean.
  Note for future agents: this worktree's `node_modules` was a symlink into
  the main checkout, which Turbopack rejects; replaced with a real `npm ci`.
- `art-search-flows.mjs` (local, lexical mode — no ANTHROPIC_API_KEY): 14/15
  MUST cases hit + both guardrails + name-mode fallback (24 results).
  The 1 miss, "sad ghost on a train", also fails identically on main (verified
  against an untouched main-branch server, same top-5): it is a pre-existing
  index-growth regression in lexical fallback, not caused by this PR (ranking
  code untouched; this PR only adds an optional result-limit parameter).
- `auth-flows.mjs` (local, full mode): all checks passed (signup, session
  persistence, logout, wrong-password error, login, gated /account).
- Detail view exercised end-to-end by `overhaul-screens.mjs`: detail render,
  zoom open/close, artist link -> artist-filtered results (722 cards, 31
  pages), unknown id -> 404.
