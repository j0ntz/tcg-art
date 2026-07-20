# TCG-Art design system

The token source of truth is `app/globals.css`; this document is the written
contract behind it. The rules distilled from `docs/research/anti-slop-ui.md`
are merge gates: a change that reintroduces a banned pattern is wrong even if
it looks fine in isolation. Every future agent inherits this system via the
"Design system" section in `CLAUDE.md`.

## Voice

Art-forward collector's gallery. The card art is the biggest thing on any
page; the chrome is a neutral gallery wall the art hangs on, and the product
speaks the game's native color language where type matters (see Color). The
feel is an energetic collector's tool, not a literary magazine. One layout
primitive repeats across the site: the **hairline ledger** — left-aligned
content rows separated by 1px `border-border` hairlines (How It Works steps,
feature lists, pricing features, card-detail metadata). Hierarchy comes from
spacing, type, and dividers, never from nesting boxes inside boxes.

## Type

Two families, self-hosted via `next/font` in `app/layout.tsx`. Never add a
third. **No serifs anywhere**: the serif/editorial flavor was evaluated
(task #47) and rejected for this product; do not reintroduce Fraunces or any
other serif. Grotesques have no true italic, so the system uses none — the
contrast axis is weight, not slant.

| Role | Family | Usage |
| --- | --- | --- |
| Display | Bricolage Grotesque (variable, `--font-bricolage`, `font-display`) | H1/H2, wordmark, prices |
| Body | IBM Plex Sans (`--font-plex-sans`, `font-sans`, the body default) | Everything else |

Scale (ratio ≥ 1.25 between display steps): `text-display` 4rem / `text-title`
2.75rem / `text-heading` 2rem / `text-lead` 1.125rem / body 1rem. Headings get
`text-wrap: balance` globally. Display headings sit at bold/extrabold; the
counter-voice is `font-light`, so hierarchy inside a step uses weight extremes
(light vs extrabold), not size alone and never italics. Numbers that line up
(counts, prices, page indicators, card numbers) use the `tnum` utility
(tabular figures).

Banned families stay banned: Inter, Roboto, Open Sans, Lato, Arial, raw
system stacks, Space Grotesk, Geist — and now every serif.

## Color

One dominant + one accent, all OKLCH, defined as two primitive ramps in
`app/globals.css`:

- **ink** (dominant): a cool near-neutral gallery ramp (chroma ≤ 0.006), the
  white-wall chrome the art hangs on. Carries every surface, all text tiers,
  borders, and the default dark action (`bg-surface-inverse`). The near-black
  `ink-950` is the "midnight cinema" stage the hero and Night Gallery sit on.
- **ember** (accent): flame orange sampled from the Charizard showcase art
  that anchors the hero. **Budget: at most 5 placements site-wide**, currently
  1. hero headline emphasis (`text-primary-bright` on the night stage)
  2. the primary CTA fill (`Button variant="accent"`)
  3. the focus ring (`--color-ring`)
  4. the pricing "Most popular" marker
  5. inline link hover on the card-detail artist link

  Spending ember anywhere else requires removing one of these first.

### Energy-type color coding (functional, outside the brand budget)

The game's own color language — Grass green, Fire red, Water blue, Lightning
yellow, Psychic purple, and the rest — is encoded as **functional** ramps in
`app/globals.css`: `--color-type-<name>-{subtle,border,strong}` for the 11
energy types. Strict rule:

- Type colors appear **only** on type-meaningful elements: a badge or chip
  that names that energy type. Today that is exactly one consumer, the
  `TypeBadge` primitive (`app/components/ui/TypeBadge.tsx`) on the card-detail
  ledger. Future type facets/filters may use it too.
- Never as decoration, section theming, chart-of-the-day accents, hover
  colors, or anything not literally naming the type. They are data ink, in
  the same class as the danger/success states.
- Psychic's purple is the game's color for that type — a functional exception
  to the no-purple rule below, never a brand or decorative color.
- Each type has a light and a dark triple. The **hue is what carries the
  meaning, so the hue is constant across themes**; only lightness and chroma
  flip (pale wash + dark text in light, deep wash + light text in dark).

Pages consume only the semantic tier (`--color-surface`, `--color-foreground-*`,
`--color-border*`, `--color-primary*`); primitives (`ink-600`, `ember-500`)
never appear in a component. No hex in components, no pure `#000` text, no
purple/indigo/violet as brand or decoration, no gradients (backgrounds, text,
or buttons), no gradient blobs/glows, no colored box-shadows (shadows are
neutral black alphas only), no cyan-on-dark.

## Themes: light and dark are both first-class

The site ships **two complete palettes**. Neither is a derivative of the other:
light is the landed gallery-white skin, dark is designed for a dark room (a
lifted near-black, never `#000`, with `surface` a step *above* `background` so
panels read as elevated where shadows cannot).

**How a theme is selected.** Every semantic role in `app/globals.css` is
`light-dark(LIGHT, DARK)`, and the resolution is driven by one property,
`color-scheme` on `<html>`:

| `<html>` | `color-scheme` | Result |
| --- | --- | --- |
| no `data-theme` | `light dark` | follows the OS (**the default**) |
| `data-theme="light"` | `light` | explicit light |
| `data-theme="dark"` | `dark` | explicit dark |

`app/layout.tsx` reads the `theme` cookie server-side and stamps the attribute
into the initial HTML, so the first paint is already correct: **no flash of the
wrong theme and no render-blocking inline script**. System mode stamps *no*
attribute, which is why OS theme changes re-theme a live page with zero JS.
`ThemeToggle` (header) writes cookie + attribute and freezes transitions for the
frame of the flip, so switching repaints at once instead of cross-fading through
a half-themed state.

### Rules for every UI change

1. **No hardcoded colors in components.** No hex, no `bg-white`/`text-black`, no
   Tailwind palette shades (`bg-slate-800`), no raw `oklch()` outside
   `globals.css`. A hardcoded color cannot theme, so it is a merge-blocking bug.
   Consume the semantic tier only. The single sanctioned exception is the
   Google "G" mark in `app/components/auth/GoogleButton.tsx`: those four hexes
   are a third-party brand asset that must NOT change with the theme.
2. **No `dark:` utilities.** There are none in the app and there must not be. A
   color that needs to differ in dark differs in the *token*, not the markup.
3. **A new semantic role needs both values.** A single-valued `--color-*` is a
   bug unless it is a stage token (below).
4. **Stage tokens are deliberately single-valued.** The midnight hero, the Night
   Gallery, and the zoom lightbox are a fixed near-black exhibition space, not a
   reflection of the user's theme: `surface-night*`, `foreground-inverse*`,
   `border-inverse`, `surface-mat`, `foreground-on-mat*`, `primary-bright`.
   Inside a frame, text follows the *mat* (`foreground-on-mat`), never the theme
   — that is the trap that renders white-on-white.
5. **Art is never themed.** Card images carry no filter, tint, or dimming in
   either theme. The art is the product.
6. **Both themes ship together.** A new surface is not done until it has been
   audited in light *and* dark.

### The build config is load-bearing

The `browserslist` field in `package.json` (Chrome 123 / Edge 123 / Firefox 120
/ Safari 17.5) is what keeps `light-dark()` in the compiled CSS. Tailwind v4
compiles through Lightning CSS, and at its default targets it silently
**downlevels every token to its light branch and strips the `color-scheme`
rules** — shipping a site with no dark theme and no build error. Do not remove
or lower it.

### Verification

`npm run theme:flows` (against a running dev server) is the gate: it asserts the
system default, live OS-change reactivity, toggle round-trip and persistence
across reload, server-stamped no-flash markup, a one-line mobile header, and —
on every surface in both themes — that no text falls under 3:1 and no card image
is filtered. It writes the `docs/screenshots/issue-57-*` proof set.

## Spacing, radius, shadow

- Spacing: 4px base rhythm through Tailwind's scale; dense grids use tight
  4/8/12 gaps (`gap-x-3 gap-y-6` in the results grid). Page gutter is
  `--spacing-gutter`; content max width is `--container-content` (72rem).
- Radius is a deliberate scale, exactly three stops: `rounded-field` (8px:
  inputs, chips, card images), `rounded-card`/`rounded-panel` (16px: panels),
  `rounded-pill` (full: pill buttons, badges, avatars). The rounder stops are
  the collector's-tool personality (card sleeve, not legal document). No
  per-component one-off radii; never a thick colored border on one card edge.
- Shadows: `shadow-card` / `shadow-card-lifted` / `shadow-float`, all neutral.

## Motion

The page-level budget is ONE signature effect: the scroll-linked hero fan
opening (`hero-fan-card`, CSS scroll timeline, reduced-motion gated). Beyond
that, only interaction-tied micro-transitions: hover lifts on card art, the
binder page-turn, carousel snap. No load or scroll-in reveals, no staggered
entrances, no bounce/elastic easing, no `transition: all`, no glow
affordances. Everything animating respects `prefers-reduced-motion`.

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
- Text on the night surface uses `foreground-inverse` tiers chosen to pass
  contrast on `ink-950`; body text on light surfaces stays at `ink-500` or
  darker.

## Process: the vision loop

UI work is not done until it has been screenshotted at desktop (1440) and
mobile (390), including empty/error states, compared against this document and
the banned-pattern list in `docs/research/anti-slop-ui.md`, fixed, and
re-screenshotted. The merge gate is zero banned-pattern findings.
