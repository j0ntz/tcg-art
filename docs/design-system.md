# TCG-Art design system

The token source of truth is `app/globals.css`; this document is the written
contract behind it. The rules distilled from `docs/research/anti-slop-ui.md`
are merge gates: a change that reintroduces a banned pattern is wrong even if
it looks fine in isolation. Every future agent inherits this system via the
"Design system" section in `CLAUDE.md`.

## Voice

Vibrant gallery / collector-pop. The frame is a bright, neutral gallery: the
card art is the biggest and loudest thing on any page, and it supplies the
color. Chrome stays near-white and quiet so saturated Pokemon art pops off the
wall; personality comes from the display face's weight extremes and from
art-derived tints, never from decoration. **Serif/editorial flavor is rejected
for this product** (product-level rule): no serif face, no italic-as-emphasis,
no literary-magazine styling may return.

One layout primitive repeats across the site: the **hairline ledger**,
left-aligned content rows separated by 1px `border-border` hairlines (How It
Works steps, feature lists, pricing features, card-detail metadata). Hierarchy
comes from spacing, type, and dividers, never from nesting boxes inside boxes.

## Type

Two families, self-hosted via `next/font` in `app/layout.tsx`. Never add a
third; never a serif.

| Role | Family | Usage |
| --- | --- | --- |
| Display | Bricolage Grotesque (variable, `--font-bricolage`, `font-display`) | H1/H2, wordmark, prices |
| Body | IBM Plex Sans (`--font-plex-sans`, `font-sans`, the body default) | Everything else |

Scale (ratio ≥ 1.25 between display steps): `text-display` 4rem / `text-title`
2.75rem / `text-heading` 2rem / `text-lead` 1.125rem / body 1rem. Headings get
`text-wrap: balance` globally. Hierarchy uses the variable face's **weight
extremes**: display headings sit at bold/extrabold (700–800), quiet display
elements (the wordmark's "·Art") drop to extralight (200). Emphasis is a
weight flip plus the accent, never italics. Numbers that line up (counts,
prices, page indicators, card numbers) use the `tnum` utility (tabular
figures).

Banned families stay banned: Inter, Roboto, Open Sans, Lato, Arial, raw
system stacks, Space Grotesk, Geist, and every serif (Fraunces included).

## Color

The chrome is ONE dominant + ONE accent, all OKLCH, defined as two primitive
ramps in `app/globals.css`:

- **ink** (dominant): a cool, near-achromatic gallery-gray ramp (hue ~252–260,
  chroma ≤ 0.006). Carries every surface, all text tiers, borders, and the
  default dark action (`bg-surface-inverse`). The page base is the near-white
  gallery wall (`--color-background`, oklch 99.2%); that light base is a
  committed decision. The near-black `ink-950` survives only as the
  darkened-room stage for the zoom lightbox and the binder's Night Gallery.
- **ember** (accent): a saturated pop orange. **Budget: at most 5 placements
  site-wide**, currently
  1. hero headline emphasis (`text-primary` on the gallery wall)
  2. the primary CTA fill (`Button variant="accent"`)
  3. the focus ring (`--color-ring`)
  4. the pricing "Most popular" marker
  5. inline link hover on the card-detail artist link

  Spending ember anywhere else requires removing one of these first.

### The art-tint channel

Separate from the chrome budget, `lib/art-tint.ts` derives a per-card tint
from the card's own indexed palette words (fallback: its energy type). The
artwork colors its own page; the brand never does. Exactly two shapes are
allowed, both fixed OKLCH recipes over a single hue:

- **wash** `oklch(96.5% 0.03 H)`: the mat behind the detail-page art.
- **ring** `oklch(70% 0.13 H)`: the hover ring on search result cards.

Components receive these as computed values/CSS variables from the helper and
never mix their own colors. Cards with achromatic or unknown palettes keep the
neutral chrome. Tints never touch text, buttons, backgrounds of chrome, or
anything outside those two shapes.

Pages consume only the semantic tier (`--color-surface`, `--color-foreground-*`,
`--color-border*`, `--color-primary*`); primitives (`ink-600`, `ember-500`)
never appear in a component. No hex in components, no pure `#000` text, no
purple/indigo/violet chrome, no gradients (backgrounds, text, or buttons), no
gradient blobs/glows, no colored box-shadows (shadows are neutral black
alphas only), no cyan-on-dark.

## Spacing, radius, shadow

- Spacing: 4px base rhythm through Tailwind's scale; dense grids use tight
  4/8/12 gaps (`gap-x-3 gap-y-6` in the results grid). Page gutter is
  `--spacing-gutter`; content max width is `--container-content` (72rem).
- Radius is a deliberate scale, exactly three stops, tuned chunky for the
  collector-pop feel: `rounded-field` (8px: inputs, chips, card images),
  `rounded-card`/`rounded-panel` (16px: panels), `rounded-pill` (full: pill
  buttons, badges, avatars). No per-component one-off radii; never a thick
  colored border on one card edge.
- Shadows: `shadow-card` / `shadow-card-lifted` / `shadow-float`, all neutral
  black alphas, slightly deeper than a flat editorial look so cards read as
  physical objects on the wall.

## Motion

The page-level budget is ONE signature effect: the scroll-linked hero fan
opening (`hero-fan-card`, CSS scroll timeline, reduced-motion gated). Beyond
that, only interaction-tied micro-transitions: hover lifts + art-tint rings on
card art, the binder page-turn, carousel snap. No load or scroll-in reveals,
no staggered entrances, no bounce/elastic easing, no `transition: all`, no
glow affordances. Everything animating respects `prefers-reduced-motion`.

## States first

Every data surface designs empty, loading, and error before the happy path:

- Route-level `loading.tsx` skeletons for `/search`, `/card/[id]`, `/binder`
  that match the loaded layout (no spinner-only screens).
- Designed empty states: search-no-query offers real example queries;
  search-no-results explains and offers the other mode; the empty binder shows
  empty sleeves. Real data only — no lorem ipsum, no placeholder-as-content.
- `app/error.tsx` (retry) and `app/not-found.tsx` (404) are designed pages.

## Accessibility

- Global `:focus-visible` ring (`--color-ring`, 2px, offset 2px). Never
  `outline-none` without a visible replacement; components rely on the global.
- Card `<Image>`s carry the card name as alt text; decorative art (the hero
  fan) is `aria-hidden`.
- Text on the night surface (lightbox, Night Gallery) uses `foreground-inverse`
  tiers chosen to pass contrast on `ink-950`; body text on light surfaces
  stays at `ink-500` or darker.

## Process: the vision loop

UI work is not done until it has been screenshotted at desktop (1440) and
mobile (390), including empty/error states, compared against this document and
the banned-pattern list in `docs/research/anti-slop-ui.md`, fixed, and
re-screenshotted. The merge gate is zero banned-pattern findings.
