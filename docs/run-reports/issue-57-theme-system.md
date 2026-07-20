<!-- orch -->
# Agent run report — Dark/light theme system: system default, global toggle, both themes first-class

**▶ Live preview: https://tcg-gd8pknmz5-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/58**

| field | value |
|---|---|
| Task | #57 · https://github.com/j0ntz/tcg-art/issues/57 |
| PR | https://github.com/j0ntz/tcg-art/pull/58 |
| Preview | https://tcg-gd8pknmz5-jontz.vercel.app |
| Branch | jon/task-57 |
| Verified | RESULT=pass |
| Date | 2026-07-19 |

## Summary

A complete dual-palette theme system landed at the token layer: every semantic
token carries both a light and a dark value via `light-dark()`, the default is
the user's system preference, and a tri-state header toggle (System / Light /
Dark) persists an override in a cookie the server reads to stamp
`<html data-theme>` before first paint. Verified cold on the live Vercel
preview: all 21 behavior assertions pass, both themes are clean on every public
surface, and there are zero hardcoded color regressions.

This run resumed the verification that was previously blocked by a GitHub
outage (no Vercel deployment existed for the prior head). The head was
re-pushed as `673b815`, Vercel produced a Ready preview, and the full check ran
to completion. No code change was needed to unblock.

## What changed

- `lib/theme.ts` — the shared choice contract. "system" is represented by the
  ABSENCE of `data-theme`, which lets `color-scheme: light dark` resolve
  `prefers-color-scheme` natively. That is what makes OS theme changes track
  live with no `matchMedia` listener and keeps the no-JS path correct.
- `app/layout.tsx` — reads the `theme` cookie server-side and stamps the
  attribute into the initial HTML. No render-blocking inline script, no flash.
- `app/components/ThemeToggle.tsx` — tri-state control in the header. Writes
  cookie + live attribute, skips the mount pass so a visitor who never touched
  it gets no cookie, and freezes transitions across the flip so the page
  repaints at once instead of cross-fading through an unreadable in-between.
- `app/globals.css` — 69 `light-dark()` token pairs. The only single-valued
  tokens are the documented fixed STAGE set (`surface-night*`, `surface-mat`,
  `foreground-inverse*`, `foreground-on-mat*`, `border-inverse`,
  `primary-bright`).
- Token migration: `text-primary-foreground` → `text-foreground-on-inverse` on
  every `bg-surface-inverse` consumer, so none inherits the ember fill color
  once `surface-inverse` flips between themes.
- `orchestration/playwright/theme-flows.mjs` — the e2e harness, plus
  `docs/design-system.md` and `CLAUDE.md` updates.

## Test evidence

- `verify-preview.sh 58 'Match system theme'` → **RESULT=pass** against
  https://tcg-gd8pknmz5-jontz.vercel.app (HTTP 200, mobile `overflowBy: 0`).
- **`theme-flows.mjs` against the live preview: all 21 assertions pass** —
  system default honored with no cookie and no attribute; OS-preference flips
  re-theme the live page; the Light choice re-themes instantly, persists to the
  cookie, and survives a reload; the reloaded server HTML already carries
  `data-theme=light` before any JS runs (no flash); returning to System clears
  the override. Contrast (nothing under 3:1) and art-untouched (no filtered or
  dimmed card images) audits pass on landing, search, login, 404, and card
  detail in BOTH themes.
- **The load-bearing `browserslist` claim holds on the deployed artifact, not
  just locally.** Fetched the preview's compiled CSS
  (`/_next/static/chunks/0hc--bk7x2jay.css`): 65 `light-dark()` occurrences
  survive Lightning CSS and all three switch rules are intact
  (`color-scheme:light dark`, `[data-theme=light]`, `[data-theme=dark]`), plus
  the `data-theme-switching` freeze. This was the stated silent-failure mode and
  it does not occur.
- **Zero hardcoded color regressions** (the acceptance grep): no hex, no
  `bg-white`/`text-black`, no Tailwind palette shades, no `dark:` utilities, no
  raw `oklch()` outside `globals.css`. The only hex in the app is
  `GoogleButton.tsx`'s four Google-brand values, which `docs/design-system.md`
  documents as the sanctioned exception.
- `npm run build` passes; TypeScript clean. No `any`, no `||` defaults
  introduced, and both `useEffect`s in the diff return cleanups.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since
  the repo is private):
  - Desktop: [issue-57-preview-landing-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-57/docs/screenshots/issue-57-preview-landing-desktop.png)
  - Mobile (~390px): [issue-57-preview-landing-mobile.png](https://github.com/j0ntz/tcg-art/blob/jon/task-57/docs/screenshots/issue-57-preview-landing-mobile.png)
  - Live preview, dark: [issue-57-preview-landing-dark-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-57/docs/screenshots/issue-57-preview-landing-dark-desktop.png)
  - Live preview, light: [issue-57-preview-landing-light-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-57/docs/screenshots/issue-57-preview-landing-light-desktop.png)
  - The author's full both-themes proof set (landing, search, detail, zoom,
    login, 404, account, binder, gallery, header; desktop + mobile) is committed
    as `docs/screenshots/issue-57-*`.

## Decisions (yolo defaults)

- **Preview proof substring.** The first run used "Night Gallery", which lives
  on the binder page, not the landing page, so it failed on a bad expectation
  rather than bad code. Re-ran with `Match system theme` (the toggle's
  server-rendered aria-label), which proves the theme system rendered on the
  page actually being fetched.
- **Remote `networkidle`.** `theme-flows.mjs` waits on `networkidle`, which is
  right for localhost but never settles against a remote CDN serving card art;
  it timed out on the search page. Confirmed non-defect (the page serves HTTP
  200 in 0.24s with content) and re-ran a `waitUntil: "load"` variant from the
  scratchpad to cover the remaining surfaces. The committed script was not
  modified. Reversible; see follow-ups.

## Notes & follow-ups

- **Authenticated surfaces could not be exercised on the preview.** The signup
  form renders `disabled` there because the preview deployment has no
  database/auth secret configured, which `CredentialsForm.tsx` handles by
  design. That file is not in this PR's diff, so this is a pre-existing
  environment limitation, not a regression. Account, binder, and Night Gallery
  were verified instead by code inspection plus the author's committed
  screenshots.
- **The Night Gallery trap is handled.** It is the riskiest surface in a
  theming change: a fixed near-black STAGE whose picture frames hold a white mat
  and placard, so the placard text must follow the MAT, not the theme. A
  theme-following token in there would read white-on-white in one theme.
  `NightGallery.tsx` correctly uses `foreground-on-mat*` inside the frames and
  `foreground-inverse*` on the stage; both committed screenshots confirm the mat
  stays white with dark text in light AND dark, with the art untinted.
- **The root layout is now dynamic.** Reading the theme cookie in
  `app/layout.tsx` opts every route into server-rendered-on-demand (all routes
  show `ƒ` in the build output; the pre-PR layout was synchronous). This is the
  inherent cost of the cookie-based no-flash approach that issue #57 explicitly
  prescribed, and the header already forced a per-request session read, so it is
  spec-compliant rather than a defect. Worth documenting in
  `docs/design-system.md` if static rendering is ever wanted back.
- **Follow-up worth filing:** parameterize `theme-flows.mjs`'s wait strategy
  (`networkidle` locally, `load` against a deployed URL) so the harness can run
  against a preview without a hand-edited copy.
