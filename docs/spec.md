# TCG-Art MVP Spec

Working name: TCG-Art. A Pokemon-card art search engine, modeled on the live product at
artfindertcg.com (walked end to end logged in, captured in `~/pokemon-artfinder-scrape-and-spec.md`).
This document is the consolidated product spec. Build and hosting decisions that sit above the
product (agent orchestration, CI posture, verification bar) live in
[orchestration-plan.md](orchestration-plan.md), which is the source of truth for those; this spec
references them where they touch the stack.

## 1. Product summary

Find a Pokemon card by what its art shows, not just by its name. The product is two search modes
plus a collection layer, wrapped in a freemium plan:

| Mode | What it does | Under the hood |
|---|---|---|
| **Find by Card** (ship first) | Look up a specific card by name or number, filter and browse results | Structured query + filters over card metadata |
| **Describe Artwork** (the differentiator) | Natural-language search over the art ("pikachu surfing on a wave") | Embedding / semantic search, ranked by relevance, not keyword match |
| **Find Similar** (from a card) | Given one card, surface visually similar art | Image-embedding nearest-neighbor |

The live product confirms all three are real and that semantic ranking genuinely works (a "pikachu
surfing on a wave" query returned every Surfing Pikachu variant first, plain Pikachus lower). The
art-search is the reason the product exists; everything else is a competent card database around it.

## 2. Target users

Collectors and players who remember a card by its art (a scene, a mood, a color) but not its name or
number, plus people hunting alt-arts and illustrations by theme or artist. Secondary: anyone pricing
a card who wants a fast lookup with a TCGplayer link.

## 3. Scope

### Phase 0: first runnable MVP (current target)

The immediate goal is to get the app off the ground and see it run locally: a Next.js app with a single
text-search box over Pokemon card data, rendering a result grid. Nothing else.

**Phase 0 in:**
- Next.js app that runs locally (`next dev`)
- One text-search input
- Text search over card name (and basic card text) via the Pokemon TCG API
- Result grid of matches (image + name + set), with loading and empty states

**Phase 0 out (deferred to the phases below):**
- No Vercel deploy yet. Verification is local only, because the operator has no remote access right now.
- No login or accounts
- No monetization, paywall, preview credits, or affiliate links
- No filters, sort, card-detail pages, favorites, binders, or semantic search

**Phase 0 verification:** local only. Run the dev server, load it in a browser, confirm a query returns
cards. The Vercel deploy and the SHA to deployment-URL to READY to browser-verify chain (orchestration
A1) come once remote access is back; that is the first step after Phase 0.

### v1 and beyond

After Phase 0 runs, the fuller v1 shell and later phases follow. The rest of this document specifies
those. Next steps, in order: deploy Phase 0 to Vercel (A1), then build out v1 below.

| In (v1) | Out (deferred) |
|---|---|
| Landing page (hero, how-it-works, pricing display) | Describe Artwork semantic search (v2) |
| Find-by-Card search (name / number) | Find Similar visual search (v3) |
| Filters: Rarity, Era (set/series), Card Type | Binders, themes, shareable binder links (v3) |
| Result grid with sort | Accounts / auth (v2, optional earlier) |
| Card detail view (full metadata, price, TCGplayer link) | Paywall, preview credits, Stripe (later) |
| Favorites (anonymous, localStorage) | Saved filter presets (Pro feature, later) |
| Mobile-responsive, SEO card pages | Multi-game beyond Pokemon |

Rationale: ship the database shell (Find by Card + filters + detail) first because it is standard
work over a free API and proves the deploy-verify loop. The semantic search is the differentiator but
the only non-trivial build, so it lands in v2 once the shell is solid.

## 4. Core features (v1)

- **Landing page.** Hero ("Find Pokemon Cards by What's In the Art"), a 3-step how-it-works section,
  a pricing table (display only in v1), footer with the IP disclaimer. Pre-rendered for SEO.
- **Find-by-Card search.** Search box matching name and collector number, with combinable filter
  dropdowns: Rarity, Era (set / series), Card Type (Pokemon / Trainer / Energy). Sort by relevance,
  release date, name, or price.
- **Result grid.** Image-first card grid, result-count badge, hover-to-favorite heart, click to open
  detail.
- **Card detail.** Large image, name, set and collector number, rarity, type/subtype chips, artist,
  series, HP, attacks, flavor text. Market price with condition and trend percentage, a
  price-by-condition breakdown, a last-updated date, and an outbound **View on TCGplayer** link
  (affiliate slot). Prev/next paging through the result set. Rendered as its own route (`/card/[id]`,
  SSG for Google) and reused as an in-app modal.
- **Favorites.** Heart a card; persisted in localStorage for v1 (no account required).
- **IP disclaimer.** "Not affiliated with The Pokemon Company, Nintendo, Creatures, or Game Freak. All
  card images and names are property of their respective owners."

## 5. Search architecture

Phased, cheapest-first, no model training at any stage:

- **v1, keyword / structured (no AI).** Hold the card dataset in our own store (Postgres, or a static
  JSON index for the first cut) and match on name, number, rarity, era, and type. Covers Find-by-Card
  and all filter behavior. Free to run.
- **v2, semantic Describe-Artwork.** One-time precompute: an embedding per card from
  `name + flavor text + an AI-generated caption of the art`, stored in Supabase pgvector. At query
  time, embed the user's text and run a nearest-neighbor lookup. Cost is a few dollars of one-time
  embedding spend, then about zero to serve. This is the product's hero feature.
- **v3, Find Similar (visual).** CLIP image embeddings of each card into the same vector store;
  "find similar" is a nearest-neighbor query on the selected card's vector. Same infrastructure, no new
  services.

Note on billing: these embedding costs are the product's own runtime spend (one-time, small) and are
unrelated to the Claude-subscription constraint that governs the build agent (see orchestration-plan.md).

## 6. Data model

Every field below comes free from the [Pokemon TCG API](https://pokemontcg.io/) (TCGdex as backup).
Images are hotlinked from the API CDN; we do not host card art.

```
Card {
  id: string
  name: string
  supertype: 'Pokemon' | 'Trainer' | 'Energy'
  subtypes: string[]
  hp: number | null
  types: string[]
  set: { id: string, name: string, series: string, releaseDate: string }
  number: string
  rarity: string
  artist: string
  flavorText: string | null
  attacks: { name: string, text: string, damage: string, cost: string[] }[]
  images: { small: string, large: string }   // CDN URLs, hotlinked
  prices: {
    tcgplayer: { updatedAt: string, byCondition: Record<string, number>, trendPct: number }
    cardmarket?: { updatedAt: string, ... }
  }
}
```

Added at v2/v3: `textEmbedding: vector`, `imageEmbedding: vector` (pgvector columns).

## 7. Tech stack and hosting

- **Framework:** Next.js (App Router). Card detail pages are statically generated for SEO; the search
  app is interactive. Chosen over Vite for SSR/SSG, server-side API-key handling, and the v2 server-side
  embedding lookups.
- **Hosting:** Vercel, deploy-on-push from `main` to production. This is a settled decision in
  orchestration-plan.md. Deferred for Phase 0: the first MVP runs and is verified locally only
  (`next dev`), with the Vercel deploy as the first step once remote access is back.
- **Data + images:** Pokemon TCG API for card data and CDN image URLs; TCGdex as a fallback source. A
  weekly GitHub Action refreshes the local dataset so new sets appear without manual work.
- **Database:** none required for the v1 cut (a built dataset index is enough). Supabase (Postgres +
  pgvector) is introduced at v2 for embeddings, and doubles as the auth and per-user store when accounts
  land.
- **Auth (v2):** Supabase Auth, email/password, matching the live product's custom auth pages (signup
  requires name, email, password of at least 8 chars with upper/lower/number/special, and a 13+ consent
  checkbox). No social login in the reference product.
- **Payments (later):** Stripe, only when the Pro tier ships.
- **Package manager / lint:** per this repo's `CLAUDE.md`, use the lockfile's manager (npm or pnpm) and
  the repo's own ESLint/Prettier with plain `git commit`. No Edge `lint-commit.sh`, no yarn.

Build and deploy posture (from orchestration-plan.md, summarized): commit to `main`, Vercel owns the
build, no GitHub Actions running Claude (the agent stays local, interactive, subscription-billed). "Done"
requires both a green Vercel build and a real browser drive of the deployed URL with a proof screenshot.
CI-green alone does not count.

Stack conventions still to lock (record the choice in `CLAUDE.md` once made): styling (Tailwind vs CSS
modules vs styled), data fetching (server components vs client TanStack Query), state (Context vs Zustand).

## 8. Page list

| Route | Purpose | Phase |
|---|---|---|
| `/` | Landing: hero, how-it-works, pricing, footer | v1 |
| `/search` (or `/app`) | Main search input, filters, result grid | v1 |
| `/card/[id]` | Card detail, SSG for SEO, reused as in-app modal | v1 |
| `/favorites` | Hearted cards (localStorage in v1, account-backed in v2) | v1 |
| `/about` | IP disclaimer, attribution, contact | v1 |
| `/login`, `/signup`, `/forgot-password` | Email/password auth | v2 |
| `/binders`, `/binders/[id]` | Collection pages, drag-and-drop grids, themes, sharing | v3 |
| `/account` | Plan, subscription, settings | later (with paywall) |

## 9. Monetization model

The reference product is freemium with a metered preview tease. Captured exactly:

| | **Free ($0 / forever)** | **Pro ($3/mo, $30/yr, or $60 lifetime)** |
|---|---|---|
| Searches | 5 / day | Unlimited |
| Results per search | 10 | 100 |
| Favorites | 10 | Unlimited |
| Search history | 10 recent | 50 recent |
| Binder pages | 2 | Unlimited |
| Saved filter presets | no | yes |
| TCGplayer pricing | yes | yes |
| Priority support | no | yes |

Mechanic: a free search shows a capped slice (10 of up to 100 results). Hidden results render as
"+N illustrations hidden" with a Preview button; users spend a small number of preview credits to reveal
cards temporarily, "Keep" to retain them, and "Unlock Full Access" to subscribe. Secondary revenue is a
TCGplayer affiliate link on every card.

MVP recommendation: build **free-tier behavior only** (cap results, simple limits, no credits), wire the
TCGplayer affiliate link from day one (near-zero effort, only real v1 revenue path), and defer Stripe and
the Pro tier until there are users. The table above is the ready-made design for that later step.

## 10. Roadmap

| Phase | Scope | Difficulty |
|---|---|---|
| **Phase 0 (current)** | Local Next.js app: single text-search box over the Pokemon TCG API, result grid. No deploy, no auth, no monetization, no filters | Trivial: get it running |
| **Phase 0.5 (next)** | Deploy Phase 0 to Vercel; de-risk the deploy-verify chain (orchestration A1) | Small, once remote access is back |
| **v1** | Landing + Find-by-Card + filters + result grid + card detail + Favorites + TCGplayer affiliate | Easy: CRUD over a free API |
| **v2** | Describe-Artwork semantic search; accounts (Supabase Auth); per-user favorites/history | Medium: one-time embeddings + pgvector |
| **v3** | Find Similar (image embeddings); Binders with themes and sharing | Medium to hard |
| **later** | Freemium paywall, preview credits, Stripe, saved filter presets | Easy code, needs payments setup |

## 11. Open decisions

1. **Lead mode for v1.** Ship the Find-by-Card shell first (recommended) or go straight at the
   Describe-Artwork differentiator. Recommendation: shell first, to prove the deploy-verify loop.
2. **Accounts in v1 or v2.** v1 can run fully anonymous (localStorage favorites, no auth). Accounts pair
   naturally with v2 semantic search and per-user limits. Recommendation: defer to v2.
3. **Dataset delivery for v1.** Static prebuilt JSON index versus a real Postgres table from day one.
   Recommendation: static index for v1 speed, migrate to Supabase at v2 when pgvector is needed anyway.
4. **Stack conventions** (styling / data fetching / state) per CLAUDE.md, to lock as the app takes shape.
5. **Monetize from launch or grow first.** Recommendation: affiliate link from day one, paywall later.

## 12. Legal and IP

Card art and names are owned by The Pokemon Company, Nintendo, Creatures, and Game Freak. Fan database
sites operate in a tolerated gray zone. We follow the same posture: a visible not-affiliated disclaimer,
images hotlinked from the official data CDNs rather than rehosted, no resale of images, and attribution in
the footer and `/about`. This is tolerance, not a legal guarantee, and should be revisited before any
paid tier or heavy promotion.
