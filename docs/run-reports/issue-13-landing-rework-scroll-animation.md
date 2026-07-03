# Agent run report: Landing rework, aurora polish + scroll-driven animation (primary of 3 options)

**▶ Live preview: https://tcg-art-git-jon-task-13-jontz.vercel.app/**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/18**

| field | value |
|---|---|
| Task | #13 · https://github.com/j0ntz/tcg-art/issues/13 |
| PR | https://github.com/j0ntz/tcg-art/pull/18 (primary) · alternates [#19](https://github.com/j0ntz/tcg-art/pull/19), [#20](https://github.com/j0ntz/tcg-art/pull/20) |
| Preview | https://tcg-art-git-jon-task-13-jontz.vercel.app |
| Branch | jon/task-13 |
| Verified | RESULT=pass |
| Date | 2026-07-02 |

## Summary
The landing page got three visually distinct reworks with scroll-driven animation, delivered as separate PRs per the task spec; this report covers the recommended primary (Option A, "aurora polish"). It layers blurred brand glows and a gradient headline accent onto the existing light identity, adds IntersectionObserver-driven staggered section reveals, and opens the hero card fan via a CSS scroll timeline as the page scrolls, all with zero new dependencies. Verified cold on the live Vercel preview: HTTP 200, zero mobile overflow at a true 390px viewport, both animation mechanisms confirmed live by scripted measurement, reduced-motion and search-flow regressions clean. One earlier review round (fan-drift keyframe dropping the -50% centering baseline) was fixed in commit da49590 and re-confirmed on the current deployment.

## What changed
- `app/components/motion/Reveal.tsx` (new): scroll-reveal wrapper. The component only flips `data-revealed` the first time an element enters the viewport; the hidden state and transition live in CSS, gated on `(prefers-reduced-motion: no-preference) and (scripting: enabled)`, so reduced-motion and no-JS visitors always get the full static page. Effect returns `observer.disconnect()`.
- `app/globals.css`: reveal transition rules (up/left/right/scale variants, per-item `--reveal-delay` stagger); `hero-fan-drift` scroll-timeline animation inside `@supports (animation-timeline: scroll())` (Chrome/Edge/Safari 26+; other browsers keep the static fan) animating the standalone `translate` property so it composes with each card's fan-geometry `transform`; new decorative glow tokens `--color-primary-glow` / `--color-accent-glow`.
- `app/components/Hero.tsx`: blurred aurora glow backdrop (aria-hidden, pointer-events-none), gradient clip on the headline's second line, `hero-fan-card` scroll drift plus hover scale on the fan cards. Search form, empty-state guard, and fan geometry untouched.
- `app/components/HowItWorks.tsx`, `Pricing.tsx`, `BuildYourBinder.tsx`: staggered reveals per section (120-140ms steps), gradient step chips, hover lift on step cards, equal-height pricing cards, and `overflow-x-clip` on the binder section so pre-reveal left/right offsets cannot widen the page on mobile.
- `orchestration/playwright/landing-screens.mjs` (new): desktop (1440) + mobile (390) full-page design captures with `reducedMotion: "reduce"` so scroll-reveal content is captured in its final resting state.
- Alternates, each a draft PR with committed desktop + mobile screenshots, compared in [the issue comment](https://github.com/j0ntz/tcg-art/issues/13#issuecomment-4872335505): [#19](https://github.com/j0ntz/tcg-art/pull/19) "midnight cinema" (dark hero, zero deps) and [#20](https://github.com/j0ntz/tcg-art/pull/20) "kinetic gallery" (`motion` v12, +52 kB gzip, spring physics).

## Test evidence
- `verify-preview.sh 18 "hero-fan-card"` → `HTTP_STATUS=200`, `MOBILE_LAYOUT={"innerWidth":390,"scrollWidth":390,"overflowBy":0}`, `RESULT=pass` against the live preview.
- Both animation mechanisms measured live on the preview (headless Chromium probe, no reduced motion):
  - Fan drift: computed `translate` is `0px -50%` on every card at rest; at 400px scroll (62.5% of the 640px range) the cards read `±10px/±20px` horizontal spread and `-15px/-26.25px/-37.5px` extra lift, exactly the keyframe math, confirming the centering baseline holds and the fan opens instead of sinking.
  - Reveals: 11 `[data-reveal]` targets; below-fold ones sit at opacity 0 before scroll, and after scrolling the full page all 11 carry `data-revealed` at opacity 1. Desktop `scrollWidth` 1440 = `innerWidth` (no overflow).
- Reduced-motion pass (emulated): every reveal target visible without scrolling and the fan card's `animationName` is `none`.
- Search regression: `/search?q=pikachu` on the preview renders 24 result cards; header/footer and hero empty-state code paths untouched by the diff.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since the repo is private). BOTH a desktop and a mobile (~390px) capture:
  - Desktop (verification capture): [issue-13-verify-desktop.png](https://github.com/j0ntz/tcg-art/blob/709a195d0e9e18452d63516b0e76d4a89b47fc55/docs/screenshots/issue-13-verify-desktop.png)
  - Mobile (true 390px, verification capture): [issue-13-verify-mobile.png](https://github.com/j0ntz/tcg-art/blob/709a195d0e9e18452d63516b0e76d4a89b47fc55/docs/screenshots/issue-13-verify-mobile.png)
  - Design-state captures (reduced motion, full content, shipped with the PR): [issue-13-primary-desktop.png](https://github.com/j0ntz/tcg-art/blob/709a195d0e9e18452d63516b0e76d4a89b47fc55/docs/screenshots/issue-13-primary-desktop.png) / [issue-13-primary-mobile.png](https://github.com/j0ntz/tcg-art/blob/709a195d0e9e18452d63516b0e76d4a89b47fc55/docs/screenshots/issue-13-primary-mobile.png)

## Decisions (yolo defaults)
- **The verification mobile capture shows blank sections below the hero; judged a capture artifact, not a defect.** The gate's full-page stitch (CDP `captureBeyondViewport`) never scrolls, so below-fold reveal targets are photographed in their pre-reveal opacity-0 state. The live scroll probe shows all 11 targets reveal on real scrolling, the reduced-motion pass shows the full static page, and the committed `issue-13-primary-mobile.png` (captured with reduced motion for exactly this reason) shows the complete mobile design. Default chosen: pass, with both capture flavors committed and explained. Reversible: n/a (documentation only).

## Notes & follow-ups
- For any future page using scroll reveals, `verify-preview.sh`'s stitched captures will show pre-reveal blank regions by design. Treat the gate capture as the overflow/hero proof and use `orchestration/playwright/landing-screens.mjs` (reduced motion) for design-complete screenshots.
- The scroll-linked fan parallax is a progressive enhancement: browsers without `animation-timeline: scroll()` support keep the static fan, and browsers without the `scripting` media feature simply never hide reveal content. No fallback code paths to maintain.
- Human follow-up on the issue: pick between options A (#18, primary), B (#19), and C (#20); the drafts should be closed once a direction lands.
