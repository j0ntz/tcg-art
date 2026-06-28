# Agent run report — Landing hero: show fanned card art on mobile + verify mobile in Testing

**▶ Live preview: https://tcg-art-git-jon-task-5-jontz.vercel.app/**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/6**

| field | value |
|---|---|
| Task | #5 · https://github.com/j0ntz/tcg-art/issues/5 |
| PR | https://github.com/j0ntz/tcg-art/pull/6 |
| Preview | https://tcg-art-git-jon-task-5-jontz.vercel.app |
| Branch | jon/task-5 |
| Verified | RESULT=pass |
| Date | 2026-06-27 |

## Summary
The landing hero's fanned showcase art (5 overlapping rotated cards) was hidden below the `lg` breakpoint, so every phone-width viewport rendered the hero text-only. The fan now renders on mobile with a tighter geometry that keeps all 5 cards inside the viewport. Verified on the live Vercel preview at both desktop width and a true 390px iPhone-class viewport: HTTP 200, `RESULT=pass`, and zero horizontal overflow on mobile (`overflowBy: 0`). While verifying, I found and fixed a real defect in the mobile-capture tooling this PR shipped (see Notes).

## What changed
- `app/components/Hero.tsx` — the fanned showcase no longer carries `hidden lg:block`. Fan geometry (spread, lift, angle, card width) is driven by CSS custom properties that the `sm`/`lg` breakpoints swap: mobile uses a tight 44px spread with `w-28` cards (all 5 stay inside a ~360px column), `sm` widens to 56px, and `lg` restores the original wide fan (96px spread, 22px lift, `w-44`) unchanged. The `showcase.length > 0` empty-state guard still holds. (Shipped by the build agent; verified, not re-authored, by this Testing pass.)
- `orchestration/screenshot-mobile.mjs` (NEW, added during this Testing pass) — faithful mobile screenshot helper. Drives Chrome over the DevTools Protocol with `Emulation.setDeviceMetricsOverride` (mobile flag, dpr 3) so it renders a true 390px phone viewport. Asserts and reports `overflowBy`. No external deps beyond Node's built-in `WebSocket` and a local Chrome.
- `orchestration/verify-preview.sh` — the mobile capture now calls the helper instead of `--window-size=390`. Reason: headless Chrome clamps its minimum window width to ~500px, so the old flag rendered the page at 500px and then cropped the PNG to 390, clipping the right edge and faking a horizontal overflow. The desktop capture is unchanged.
- Conventions: web TS standards (no `any`, `!= null` conditions, `??`, `React.FC`), Tailwind v4, App Router.

## Test evidence
- `verify-preview.sh 6 "What&#x27;s In the Art"` → `HTTP_STATUS=200`, `MOBILE_LAYOUT={"innerWidth":390,"scrollWidth":390,"overflowBy":0}`, `RESULT=pass` against the live preview (https://tcg-art-git-jon-task-5-jontz.vercel.app).
- Mobile correctness was cross-checked independently via the DevTools Protocol at a true 390px viewport: `horizontalOverflow: false`, and all 5 fan cards within bounds (leftmost `left=36`, rightmost `right=354`, inside the 0–390 viewport). No card clipped off-screen.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since the repo is private). BOTH a desktop and a mobile (~390px) capture:
  - Desktop: [issue-5-hero-desktop.png](https://github.com/j0ntz/tcg-art/blob/ecb3c3a3c2619e734cbeff06fe6e7dc9e72ffb0f/docs/screenshots/issue-5-hero-desktop.png)
  - Mobile (true 390px): [issue-5-hero-mobile.png](https://github.com/j0ntz/tcg-art/blob/ecb3c3a3c2619e734cbeff06fe6e7dc9e72ffb0f/docs/screenshots/issue-5-hero-mobile.png)

## Decisions (yolo defaults)
- **The mobile screenshot from the as-shipped tooling was misleading.** `verify-preview.sh` initially returned `RESULT=pass`, but its mobile PNG showed the nav, headline, search box, and the rightmost card all clipped at the right edge, which reads as a horizontal overflow. Rather than pass on a misleading capture or block on a false overflow, I measured the real page over the DevTools Protocol at a true 390px viewport and confirmed `overflowBy: 0` with every card in bounds. Default chosen: the page is correct; the capture tool was wrong, so I fixed the tool (CDP device emulation) and re-verified. Reversible: tooling-only change, desktop capture untouched.
- **Faithful-capture mechanism: CDP over Node's built-in WebSocket, not Playwright.** `@playwright/test` is a devDependency but is not installed in this worktree, and the cron/launchd orchestration runs on this machine (Node 24, global `WebSocket` available). Default chosen: a dependency-free CDP helper reusing the Chrome binary `verify-preview.sh` already targets. Reversible: can swap to a Playwright `isMobile` context later if Playwright becomes a guaranteed install.

## Notes & follow-ups
- **Why the old `--window-size=390` capture lied.** Headless Chrome (both `--headless` and `--headless=new`) enforces a ~500px minimum window width; `--window-size=390,844` therefore lays out at 500px and the `--screenshot` output is cropped to 390px wide, clipping ~110px off the right and making a non-overflowing page look like it overflows. The only reliable way to render below 500px is device-metrics emulation (what the helper now does). Confirmed empirically: window-size mode reported `innerWidth=500`; emulation mode reported `innerWidth=390, overflowBy=0`.
- This fix makes every future Testing run's mobile screenshot trustworthy, not just this task's. The `mobile-verification` rule in `.claude/skills/test-task/SKILL.md` (shipped by the build agent) now has a capture path that actually renders mobile.
