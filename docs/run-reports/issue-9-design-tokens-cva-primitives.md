# Agent run report — Two-tier design tokens + shared CVA primitives

**▶ Live preview: https://tcg-4e4fdqvio-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/10**

| field | value |
|---|---|
| Task | #9 · https://github.com/j0ntz/tcg-art/issues/9 |
| PR | https://github.com/j0ntz/tcg-art/pull/10 |
| Preview | https://tcg-4e4fdqvio-jontz.vercel.app (HEAD 71192c8) |
| Branch | jon/task-9 |
| Verified | pass |
| Date | 2026-06-27 |

## Summary
Established a central two-tier design-token source (primitive `@theme` ramps aliased by semantic role tokens) plus shared CVA component primitives, and refactored the landing components, `/search`, and `/signup` onto them. Verified the Vercel preview live: all three pages return HTTP 200 and render correctly on desktop and mobile, with the brand palette, gradient, cards, badges, and buttons all sourced from the new tokens. No visual regression: the landing mobile view is pixel-identical to the pre-PR `main` deployment, confirming the refactor preserved appearance by construction.

## What changed
- `app/globals.css`: tier-1 primitive tokens in `@theme static` (`--color-brand-*` violet, `--color-accent-*` indigo, `--color-ink-*` zinc, radius/shadow/type/spacing scales) and tier-2 semantic aliases (`--color-primary`, `--color-surface`, `--color-foreground*`, `--color-border`, `--color-ring`, state tokens). Decorative brand gradient lives in `:root` with a `bg-brand-gradient` `@utility`. Comment block documents the two tiers and when to add a token vs a one-off.
- `lib/utils.ts`: `cn()` helper (`clsx` + `tailwind-merge`).
- `app/components/ui/`: `Button`, `Badge`, `Card`, `SectionHeading` built with `class-variance-authority`, shadcn copy-own style. No CVA for variant-less one-offs.
- Refactored `app/components/*`, `app/search`, `app/signup` off hardcoded hex/utility soup onto the semantic tokens and shared primitives.
- New deps (only): `clsx`, `tailwind-merge`, `class-variance-authority`.

## Test evidence
- `verify-preview.sh 10 "Simple Pricing"` → **RESULT=pass** (HTTP 200) against the current-HEAD preview (https://tcg-4e4fdqvio-jontz.vercel.app, commit 71192c8, which includes the address-round fix routing the last primitive leaks through semantic tokens).
- All three pages return HTTP 200 on the preview: landing `/`, `/search`, `/signup`.
- Desktop and mobile (390px-wide) screenshots re-captured for each page on the current HEAD by a fresh testing agent. Landing renders the full token-sourced layout (hero, How It Works cards, brand-gradient Build Your Binder, Simple Pricing CVA cards/badges/buttons); `/search` and `/signup` render the token-sourced forms with #8 parity intact. No visual regression. The right-edge crop visible in the mobile PNGs is a headless-Chrome capture artifact (plain `--screenshot` does not emulate a device viewport), not a layout defect; body content stacks correctly at mobile width.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since the repo is private):
  - [landing — desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-9/docs/screenshots/issue-9-landing-desktop.png)
  - [landing — mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-9/docs/screenshots/issue-9-landing-mobile.png)
  - [landing — mobile, pre-PR main baseline (identical)](https://github.com/j0ntz/tcg-art/blob/jon/task-9/docs/screenshots/issue-9-landing-mobile-main-baseline.png)
  - [search — desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-9/docs/screenshots/issue-9-search-desktop.png)
  - [search — mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-9/docs/screenshots/issue-9-search-mobile.png)
  - [signup — desktop](https://github.com/j0ntz/tcg-art/blob/jon/task-9/docs/screenshots/issue-9-signup-desktop.png)
  - [signup — mobile](https://github.com/j0ntz/tcg-art/blob/jon/task-9/docs/screenshots/issue-9-signup-mobile.png)

## Decisions (yolo defaults)
- Verification substring chosen as the stable "Simple Pricing" section heading to prove the landing rendered through to the CVA pricing cards. Reversible (verification-only).
- Mobile regression check done by comparing against the live pre-PR `main` Production deployment rather than a local rebuild, since the deployed artifact is the ground truth for "no visual regression." Reversible.

## Notes & follow-ups
- The headless screenshot tool (`verify-preview.sh` and the manual captures) does not emulate a mobile viewport, so mobile PNGs show a right-edge crop on all branches. Real mobile rendering is fine; if future tasks need true mobile screenshots, drive Chrome with device emulation (CDP `Emulation.setDeviceMetricsOverride`). Not a blocker here.
- No code changes were required during this testing pass; the current-HEAD preview was correct on the first verification round. Screenshots and preview URL were refreshed to the current HEAD (71192c8) since the prior report captured an earlier commit.
