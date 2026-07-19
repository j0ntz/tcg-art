# Research: avoiding "AI slop" UI in agent-built products

Compiled 2026-07-19 by a deep-research agent (Opus 4.8) from practitioner critiques, Anthropic's
frontend-aesthetics guidance, agent design systems (ui-craft, superdesign), and gallery-product
references. Source of truth for the site-overhaul task and future UI work. Summary here; the
distilled hard rules are the contract.

## Product-level addition (tcg-art)

- Serif/editorial flavor is REJECTED for this product (operator decision,
  task #53 brief): no serif families anywhere, no italic-serif emphasis, no
  literary-magazine tone. Display type is a characterful sans/grotesque from
  the allowed families.

## Distilled hard rules

- Max 2 typefaces: 1 display + 1 body. Banned: Inter, Roboto, Open Sans, Lato, Arial, system
  stacks, AND the escape hatches Space Grotesk / Geist. Pick from mood-appropriate families
  (editorial: Fraunces, Newsreader, Crimson Pro; distinctive: Bricolage Grotesque; technical:
  IBM Plex). Type scale ratio >= 1.25 with clear steps; use weight extremes (200/800) for
  hierarchy, not size alone. text-wrap: balance on headings; tabular-nums for numbers.
- Color: ONE dominant color + ONE accent used in <= 5 placements, defined in OKLCH tokens,
  ideally derived from card art. Banned: purple/indigo/violet defaults, purple-cyan gradients,
  gradient blobs/glows, colored box-shadows, cyan-on-dark, pure #000 text.
- Spacing: single base unit (4 or 8px), consistent rhythm; tight 4/8/12 in dense grids; no
  one-off magic gaps. Hierarchy via spacing/type/dividers, NOT nested containers.
- Radius: a defined SCALE (e.g. 2 values + full), never one radius everywhere. Banned: thick
  colored border on one card edge (the single most recognizable tell).
- Layout: one strong layout primitive repeated. Banned: icon-on-top feature-card grids,
  three-box rounded hero grids, 01/02/03 decorative eyebrows, ALL-CAPS letter-spaced kickers,
  badge-above-hero-H1, stat banners, fake testimonials, emoji-as-icons, cards-in-cards,
  centered-everything, glassmorphism-as-decoration.
- Motion: tied to interaction intent, page-level motion budget, honor prefers-reduced-motion.
  Banned: stagger-everything-on-load, bounce/elastic easing, glow affordances, transition: all.
- States first: design empty/loading/error/partial before happy path. Real data, never
  placeholders. No Lorem ipsum, no placeholder-as-label, no outline:none without :focus-visible.
- Process: vision self-review loop is MANDATORY: render -> screenshot key states at
  mobile/desktop -> compare against tokens + this rule list -> fix -> re-screenshot. Merge gate:
  zero critical anti-slop findings.

## Reference direction for tcg-art

- Cosmos/Savee/Are.na mechanics: the ART is the biggest thing on the page; minimal chrome;
  serendipitous resurfacing alongside direct search.
- Masonry/editorial (authored asymmetry over a strict grid) for landing + browse surfaces;
  clean uniform grid for literal search results (fast scanning); tight density there.
- Domain exemplars (Pokemon TCG Illustration Exhibition, artofpkm.com): artist as first-class
  browse axis; high-res art zoom; curatorial/thematic entry points.

## Full findings

(Condensed; original agent report with per-claim sources lives in the task that produced this
doc. Key sources: developersdigest.tech 16-patterns catalog; prg.sh Tailwind indigo-500 history;
impeccable.style/slop; 925studios; Anthropic frontend-aesthetics cookbook + frontend-design
plugin; superdesign.dev workflow; github.com/educlopez/ui-craft (anti-slop detector, 10-pass
finish protocol); Tweag agentic-coding handbook visual-feedback loop; Awwwards masonry;
setproduct/paulwallas data-density; pokemon.com illustration exhibition; artofpkm.com.)
