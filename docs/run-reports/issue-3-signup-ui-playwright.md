# Agent run report — Add account-creation form (signup UI only) + drive it with Playwright

**▶ Live preview: https://tcg-k0m7wof5h-jontz.vercel.app/signup**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/4**

| field | value |
|---|---|
| Task | #3 · https://github.com/j0ntz/tcg-art/issues/3 |
| PR | https://github.com/j0ntz/tcg-art/pull/4 |
| Preview | https://tcg-k0m7wof5h-jontz.vercel.app |
| Branch | jon/task-3 |
| Verified | RESULT=pass |
| Date | 2026-06-26 |

## Summary
Added a UI-only signup flow at `/signup` (email, password, confirm-password, "Create Account"), with client-side validation and a "Check your email" success state. The landing page now wires both the "Sign Up Free" and "Go Pro" CTAs to it. Playwright was set up from scratch and drives the flow against the deployed Vercel preview, capturing the empty form, a validation-error state, and the success state. Preview verified live (HTTP 200, RESULT=pass).

## What changed
- `app/signup/page.tsx` — server component shell with metadata; renders the client form.
- `app/signup/SignupForm.tsx` — client component (`"use client"`) holding form state, validation, and the success state. Validation: regex email check, password min length 8, confirm-matches; inline `role="alert"` errors. No backend, no real account.
- `app/page.tsx` — added a top nav with "Sign Up Free" (outline) and "Go Pro" (solid) CTAs, both linking to `/signup`.
- `orchestration/playwright/signup-screens.mjs` — Playwright driver: 1440-wide viewport, deviceScaleFactor 2, `BASE_URL`-targeted; captures the three states. Added `@playwright/test` dev dependency and a `signup:screens` npm script.
- Conventions: web TS standards (no `any`, `!= null` conditions, `??`, `React.FC`), Tailwind v4, App Router. Success state uses a `data-testid` for a stable Playwright selector.

## Test evidence
- `verify-preview.sh 4 "Sign Up Free"` → `HTTP_STATUS=200`, `RESULT=pass` against the preview (https://tcg-k0m7wof5h-jontz.vercel.app).
- Local `next build` passed before the PR (gate); both `/` and `/signup` build clean.
- Playwright drove the signup flow end to end against the deployed preview and captured all three screenshots.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since the repo is private):
  - [signup-empty.png](https://github.com/j0ntz/tcg-art/blob/09f8ef170043e2a2af0a9669fe8be42d5aca0168/docs/screenshots/signup-empty.png)
  - [signup-error.png](https://github.com/j0ntz/tcg-art/blob/09f8ef170043e2a2af0a9669fe8be42d5aca0168/docs/screenshots/signup-error.png)
  - [signup-success.png](https://github.com/j0ntz/tcg-art/blob/09f8ef170043e2a2af0a9669fe8be42d5aca0168/docs/screenshots/signup-success.png)
  - [signup-verify-landing.png](https://github.com/j0ntz/tcg-art/blob/09f8ef170043e2a2af0a9669fe8be42d5aca0168/docs/screenshots/signup-verify-landing.png)

## Decisions (yolo defaults)
- **No "Sign Up Free"/"Go Pro" CTAs existed on the landing page.** The current landing is the Phase 0 search page, not the v1 hero with a pricing table. Default chosen: added a small top nav with both CTAs (both point to `/signup`, since there is no Pro/checkout flow yet). Reversible: trivial to relocate into a future hero/pricing section.
- **Password rule.** Task said "min length"; the spec mentions 8 chars with character-class rules for the eventual real auth. Default chosen: min length 8 only (simple, matches the task's stated bar). Reversible: strengthen later when real auth lands.
- **"Go Pro" target.** No paywall/checkout exists. Default chosen: route it to `/signup` for now. Reversible.
- **Playwright as a standalone driver script** (not the `@playwright/test` runner). Default chosen: a plain Node script parameterized by `BASE_URL`, since the job is "load preview, click, screenshot," not an assertion suite. Reversible: can wrap in the test runner later.

## Notes & follow-ups
- **Reusable `/playwright` skill — recommendation: not worth it yet; ad-hoc per-task is fine.** Setup was straightforward: `@playwright/test` + `playwright install chromium`, then ~50 lines of script. The only friction was environment-specific, not Playwright-specific: bare `npm`/`npx` are blocked here (must prefix with `sfw`), and the `sfw` hook scans command strings, so a heredoc containing the literal word "npm" gets rejected (write such files with the editor instead of `cat <<EOF`). The genuinely reusable part is tiny: a viewport/deviceScaleFactor convention, `BASE_URL` targeting the preview, and writing into `docs/screenshots/`. That is better captured as a 40-line template script to copy per task than as a skill, until there are several distinct flows to drive. Revisit if/when multiple pages need routine screenshot capture (e.g. card detail, search, favorites), at which point a thin `screens.mjs <route> <steps>` helper or a real skill pays off.
- The shared `node_modules` symlink (to the main checkout) was replaced by a real local `node_modules` when `npm install` ran in this worktree; this isolates deps to the worktree, which is desirable.
