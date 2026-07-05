# Agent run report — Landing rework: midnight cinema hero + timeline steps (chosen option B)

**▶ Live preview: https://tcg-art-git-jon-task-13-jontz.vercel.app/**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/18**

| field | value |
|---|---|
| Task | #13 · https://github.com/j0ntz/tcg-art/issues/13 |
| PR | https://github.com/j0ntz/tcg-art/pull/18 |
| Preview | https://tcg-7auqq3b5p-jontz.vercel.app (deployment for head e315eff) |
| Branch | jon/task-13 |
| Verified | RESULT=pass |
| Date | 2026-07-05 |

## Summary
This verification covers the promoted option B ("midnight cinema") now carried by the primary PR: a near-black hero with saturated glow spotlights and a rim-lit card fan, a bright gradient headline, a glassy search input, and a light body where How It Works becomes a vertical timeline. Scroll motion comes from two progressive enhancements: IntersectionObserver staggered reveals (CSS transitions, safe for no-JS and reduced-motion visitors) and a CSS scroll-timeline fan opening. Verified cold on the live Vercel preview: HTTP 200, zero mobile overflow at a true 390px viewport, both animation mechanisms confirmed by scripted measurement, reduced motion and the search flow clean. The carried-over keyframe fix (commit e315eff, keeping the -50% centering baseline in `hero-fan-open`) was explicitly re-verified: the fan opens and lifts instead of sinking. No change requests; routed to Verified.

## What changed
- `app/components/Hero.tsx`: midnight cinema stage. Near-black `bg-surface-night` section with three aria-hidden glow fills, gradient-clipped headline accent, glassy search input, brand-tinted rim glow shadow on the fan cards, and the `hero-fan-card` scroll-linked opening. Search form action, fan geometry, and the empty-state guard (`showcase.length > 0`) untouched.
- `app/components/motion/Reveal.tsx` (new): scroll-reveal wrapper that only flips `data-revealed` on first viewport entry; hidden state and transition live in CSS gated on `(prefers-reduced-motion: no-preference) and (scripting: enabled)`. Effect returns `observer.disconnect()`.
- `app/globals.css`: reveal transition rules (up/left/right/scale + `--reveal-delay` stagger), the `hero-fan-open` scroll-timeline keyframe animating the standalone `translate` property so it composes with each card's fan-geometry `transform` while keeping the `-50%` centering baseline, and new midnight color roles (`surface-night`, glow/bright brand steps, inverse copy tiers) that all resolve to existing palette tokens.
- `app/components/HowItWorks.tsx`: restyled as a vertical timeline (connecting line, gradient number stops), steps sliding in from the left with 120ms stagger; section is `overflow-x-clip` so pre-reveal offsets cannot widen the page.
- `app/components/Pricing.tsx`, `app/components/BuildYourBinder.tsx`: staggered scale/left/right reveals, equal-height pricing cards, `overflow-x-clip` on the binder section.
- `orchestration/playwright/landing-screens.mjs` (new): desktop (1440) + mobile (390) full-page design captures with `reducedMotion: "reduce"` so reveal content is captured in its final resting state.

## Test evidence
- `verify-preview.sh 18 "data-reveal"` → `HTTP_STATUS=200`, `MOBILE_LAYOUT={"innerWidth":390,"scrollWidth":390,"overflowBy":0}`, `RESULT=pass` against https://tcg-7auqq3b5p-jontz.vercel.app.
- Both animation mechanisms measured live on the preview (headless Chromium probe, no reduced motion):
  - Fan opening: computed `translate` is `0px -50%` on every card at rest (the e315eff baseline fix holds); at 350px scroll the cards read exactly half the keyframe deltas, and at the 700px range end they read `±34px/±68px` horizontal spread with `-12/-26/-40px` extra lift, exactly `x = i*34px`, `y = -50% - 12px - |i|*14px`. The fan opens and lifts; it does not sink.
  - Reveals: 11 `[data-reveal]` targets; 10 below-fold targets sit at opacity 0 before scroll, and after scrolling the full page all 11 carry `data-revealed` at opacity 1. Desktop `scrollWidth` 1440 = `innerWidth` (no overflow).
- Reduced-motion pass (emulated): all 11 reveal targets visible without scrolling and the fan card's `animationName` is `none`.
- Search regression: `/search?q=pikachu` on the preview renders 24 result images; header/footer and the hero empty-state path are untouched by the diff.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since the repo is private). BOTH a desktop and a mobile (~390px) capture:
  - Desktop (verification capture): [issue-13-verify-desktop.png](https://github.com/j0ntz/tcg-art/blob/14c28d781ca70f9297662f30971b059580541a6c/docs/screenshots/issue-13-verify-desktop.png)
  - Mobile (true 390px, verification capture): [issue-13-verify-mobile.png](https://github.com/j0ntz/tcg-art/blob/14c28d781ca70f9297662f30971b059580541a6c/docs/screenshots/issue-13-verify-mobile.png)
  - Design-state captures (reduced motion, full content, shipped with the PR): [issue-13-opt-midnight-desktop.png](https://github.com/j0ntz/tcg-art/blob/14c28d781ca70f9297662f30971b059580541a6c/docs/screenshots/issue-13-opt-midnight-desktop.png) / [issue-13-opt-midnight-mobile.png](https://github.com/j0ntz/tcg-art/blob/14c28d781ca70f9297662f30971b059580541a6c/docs/screenshots/issue-13-opt-midnight-mobile.png)

## Decisions (yolo defaults)
- **The verification mobile capture shows blank regions below the hero; judged a capture artifact, not a defect.** The gate's full-page stitch (CDP `captureBeyondViewport`) never scrolls, so below-fold reveal targets are photographed in their pre-reveal opacity-0 state. The live scroll probe shows all 11 targets reveal on real scrolling, the reduced-motion pass shows the full static page, and the committed `issue-13-opt-midnight-mobile.png` (captured with reduced motion for exactly this reason) shows the complete mobile design. Default chosen: pass, with both capture flavors committed and explained. Reversible: n/a (documentation only).

## Notes & follow-ups
- Verification history: option A was verified on this branch on 2026-07-02, then the human chose option B on the issue; commit cafbddc promoted B into `jon/task-13` and e315eff re-applied the round-1 keyframe fix to B's `hero-fan-open`. This report supersedes the option-A report for landing purposes; drafts #19 and #20 are closed.
- The scroll-linked fan opening is a progressive enhancement: browsers without `animation-timeline: scroll()` keep the static fan, and browsers without the `scripting` media feature never hide reveal content. No fallback code paths to maintain.
- The light sticky header over the dark hero was flagged in the comparison comment as the taste call of this option; the human chose B with that on the table, so it is not raised as a change request.
