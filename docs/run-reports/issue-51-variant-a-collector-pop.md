<!-- orch -->
# Agent run report — UI flavor variant A: vibrant gallery / collector-pop (re-skin only)

**▶ Live preview: https://tcg-art-git-jon-task-51-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/54**

| field | value |
|---|---|
| Task | #51 · https://github.com/j0ntz/tcg-art/issues/51 |
| PR | https://github.com/j0ntz/tcg-art/pull/54 |
| Preview | https://tcg-art-git-jon-task-51-jontz.vercel.app |
| Branch | jon/task-51 |
| Verified | pass |
| Date | 2026-07-19 |

## Summary
Variant A re-skin verified clean: the site now wears the vibrant-gallery / collector-pop flavor on the unchanged token architecture. Bricolage Grotesque replaces Fraunces for display (no serifs or italics anywhere), the chrome moved to a near-white cool-neutral gallery base with a saturated pop-orange ember accent (same 5-placement budget), radius chunked to 8/16/pill, and a new art-tint channel (`lib/art-tint.ts`) lets each card's own palette color its detail-page wash and search hover ring. Structure, routes, and behavior are untouched. PR stays open at Verified for the three-variant comparison; not merged per the brief.

## What changed
- `app/layout.tsx` + `app/globals.css`: Bricolage Grotesque display face; cool achromatic ink ramp (hue ~252-260), near-white background (oklch 99.2%), pop-orange ember ramp, 8/16/pill radius, slightly deeper neutral shadows. `ink-950` survives only as the zoom lightbox and Night Gallery stage.
- All display headings move from `font-semibold` + italic emphasis to weight extremes (`font-bold`/`font-extrabold` vs `font-extralight`); every `italic` usage removed (hero em, wordmark, flavor text, Night Gallery captions).
- `app/components/Hero.tsx`: midnight stage replaced by the light gallery wall; same layout, fan, and ember placements.
- `lib/art-tint.ts` (new): palette-word/energy-type to OKLCH hue mapping producing exactly two fixed shapes, a wash `oklch(96.5% 0.03 H)` behind detail art and a ring `oklch(70% 0.13 H)` for result hover. Consumed by `app/card/[id]/page.tsx` and `app/search/page.tsx`.
- `docs/design-system.md` + `CLAUDE.md`: direction A recorded as canon-candidate, including the product-level rule that serif/editorial flavor is rejected.

## Test evidence
- `verify-preview.sh 54 "not-italic"` → pass (HTTP 200, desktop + 390px mobile captures, mobile overflowBy=0) against https://tcg-art-git-jon-task-51-jontz.vercel.app.
- Live spot checks: `/card/sv3pt5-199` renders the Fire-hue wash `oklch(96.5% 0.03 40)` behind the art; `/search?q=charizard&mode=art` emits per-card `--art-ring` values (hues 25/45/250) on result items. `tsc --noEmit` clean.
- Cold review: no serif/italic remnants (grep clean), tokens consumed semantically, web TS standards met, scope limited to the re-skin. Zero change requests.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since the repo is private):
  - Desktop: [issue-51-verify-landing-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-51/docs/screenshots/issue-51-verify-landing-desktop.png)
  - Mobile (~390px): [issue-51-verify-landing-mobile.png](https://github.com/j0ntz/tcg-art/blob/jon/task-51/docs/screenshots/issue-51-verify-landing-mobile.png)
  - Builder's full set (landing/search incl. empty + no-results/detail/404/signup, desktop+mobile): [docs/screenshots](https://github.com/j0ntz/tcg-art/tree/jon/task-51/docs/screenshots)

## Decisions (yolo defaults)
- Detail-page tint derives from energy type only (`artTint([], card.types)`) because API card data carries no indexed palette; search results use real palette words. Reversible by threading index palette data into the detail fetch.
- The issue's direction text mentions tinting "the color facet"; no color facet surface exists in the current search UI, so the tint channel covers the two surfaces that exist (detail wash, hover ring). Not a scope gap.

## Notes & follow-ups
_None._
