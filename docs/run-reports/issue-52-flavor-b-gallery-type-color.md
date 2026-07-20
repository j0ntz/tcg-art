<!-- orch -->
# Agent run report: UI flavor variant B (gallery + game-native type-color coding)

**▶ Live preview: https://tcg-art-git-jon-task-52-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/55**

| field | value |
|---|---|
| Task | #52 · https://github.com/j0ntz/tcg-art/issues/52 |
| PR | https://github.com/j0ntz/tcg-art/pull/55 |
| Preview | https://tcg-art-git-jon-task-52-jontz.vercel.app |
| Branch | jon/task-52 |
| Build | pass (`npm run build`, Next 16.2.9) |
| Verified | pass (`verify-preview.sh 55`, HTTP 200, no mobile overflow) |
| Date | 2026-07-19 |

## Summary

Re-skin only (Direction B): the serif/editorial flavor is out, replaced by a
characterful grotesque and neutral gallery chrome, plus the game's own
energy-type palette as strictly functional color coding. No layout, component
structure, route, or behavior changes; the two-tier token architecture from
task #47 is untouched, only its values and consumers changed.

What changed, by the task's scope list:

- **Type**: Fraunces (serif) is gone. Display face is now Bricolage
  Grotesque (variable, `--font-bricolage`), body stays IBM Plex Sans. All
  italics removed (a grotesque has no true italic); hierarchy contrast moved
  to weight extremes: display headings at bold/extrabold, counter-voice at
  light. Wordmark is now extrabold "TCG" + light "·Art". Card flavor text is
  a hairline-left quote instead of a serif italic pull quote.
- **Color values**: the "ink" dominant ramp shifted from warm paper to a
  cool near-neutral gallery ramp (chroma ≤ 0.006, white-wall chrome); the
  ember accent and its 5-placement budget are unchanged. NEW: 11 functional
  energy-type ramps (`--color-type-<name>-{subtle,border,strong}`) with a
  strict rule recorded in globals.css and docs: type colors appear only on
  elements naming that energy type, never as decoration. Sole consumer today
  is the new `TypeBadge` primitive on the card-detail Type row (e.g. the
  "Fire" chip on Base Set Charizard). Psychic purple is documented as a
  functional exception to the no-purple rule.
- **Radius personality**: field 6px→8px, card 12px→16px (scale still exactly
  three stops); shadows stay neutral; the motion budget (scroll-linked hero
  fan + micro-transitions) is unchanged.
- **Microcopy**: museum-formal reads softened ("Illus." → "Art by",
  "Acquired" → "Added", "edition of N" → "×N", "credited to this
  illustrator" → "this artist has drawn"). "The Night Gallery" string kept
  (e2e asserts it).
- **Docs**: `docs/design-system.md` and the CLAUDE.md design section updated
  to Direction B, including the product-level rule: serif/editorial flavor
  is rejected; no serifs, no italics.

## Vision loop screenshots (docs/screenshots/)

| surface | desktop 1440 | mobile 390 |
|---|---|---|
| Landing | issue-52-landing-desktop.png | issue-52-landing-mobile.png |
| Search results (art mode) | issue-52-search-art-desktop.png | issue-52-search-art-mobile.png |
| Search empty state | issue-52-search-empty-desktop.png | issue-52-search-empty-mobile.png |
| Card detail (Fire TypeBadge) | issue-52-card-detail-desktop.png | issue-52-card-detail-mobile.png |

Audited against `docs/research/anti-slop-ui.md`: zero banned-pattern
findings. No serifs, two families total, one dominant + one budgeted
accent, type colors only on type-naming chips, no gradients/glows/colored
shadows, radius scale intact, motion budget intact, focus ring intact,
states unchanged.

## Test evidence (verification run)

- `verify-preview.sh 55 "font-extrabold"` → **pass** against the head-sha
  preview (HTTP 200, expected substring rendered, mobile 390px overflowBy 0).
- Card detail spot-check on the live preview (`/card/base1-4`): the Fire
  `TypeBadge` renders with `type-fire-{subtle,border,strong}` tokens; flavor
  text is the hairline-left quote, no italics anywhere.
- Cold review of the PR diff: no change requests. Both round-1 review
  threads (CLAUDE.md radius bullet, Carousel microcopy) are addressed in
  708f072 and resolved.
- Screenshots (committed under `docs/screenshots/`, blob links since the
  repo is private):
  - Desktop: [issue-52-landing-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-52/docs/screenshots/issue-52-landing-desktop.png)
  - Mobile (390px): [issue-52-landing-mobile.png](https://github.com/j0ntz/tcg-art/blob/jon/task-52/docs/screenshots/issue-52-landing-mobile.png)
  - Card detail (Fire TypeBadge): [desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-52/docs/screenshots/issue-52-card-detail-desktop.png) · [mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-52/docs/screenshots/issue-52-card-detail-mobile.png)
  - Search: [art desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-52/docs/screenshots/issue-52-search-art-desktop.png) · [art mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-52/docs/screenshots/issue-52-search-art-mobile.png) · [empty desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-52/docs/screenshots/issue-52-search-empty-desktop.png) · [empty mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-52/docs/screenshots/issue-52-search-empty-mobile.png)

## Decisions (yolo defaults)

_None._

## Notes & follow-ups

- Per the task brief this PR stays OPEN at Verified for the three-variant
  comparison; do not merge until the human picks a winner.
