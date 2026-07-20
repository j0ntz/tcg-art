<!-- orch -->
# Agent run report — Theme completeness: screenshot-based surface guard

**▶ Live preview: https://tcg-ln8vvz26i-jontz.vercel.app**  ·  **PR: https://github.com/j0ntz/tcg-art/pull/60**

| field | value |
|---|---|
| Task | #59 · https://github.com/j0ntz/tcg-art/issues/59 |
| PR | https://github.com/j0ntz/tcg-art/pull/60 |
| Preview | https://tcg-ln8vvz26i-jontz.vercel.app |
| Branch | jon/task-59 |
| Verified | pass |
| Date | 2026-07-19 |

## Summary

Verified cold. The PR's central claim, that the reported light-in-dark bug no
longer reproduces and the real gap was the guard, holds under independent
testing. I re-audited all seven public surfaces on the preview in both themes at
1440 and 390 off screenshot pixels rather than the DOM, and found zero wrong
samples. I then mutation-tested the new guard by injecting four different
overpaint shapes into a live page; it caught every one, including the one shape
that leaves text contrast clean and would therefore slip past every pre-existing
assertion. `npm run theme:flows` passes end to end at exit 0.

## What changed

- `orchestration/playwright/theme-flows.mjs`: the surface guard. Two checks per
  surface, per theme, per viewport. Check A screenshots the page, decodes it on
  an in-page canvas, and samples the left and right gutter columns down the full
  scroll height. Check B hit-tests a grid and walks up to the first ancestor
  painting an opaque background, which names the offender when A trips. Adds
  `search-prompt`, `search-empty` and `signup` to the audited set.
- `app/components/Hero.tsx`, `app/components/binder/NightGallery.tsx`,
  `app/card/[id]/ArtZoom.tsx`: `data-stage` markers so the three deliberately
  fixed near-black surfaces opt out of the guard by contract instead of by
  selector, which would rot silently.
- `docs/design-system.md`: the screenshot-based rule and the `data-stage`
  contract are written down, so the next UI change inherits them.
- No token fixes, because none were needed. See below.

## Test evidence

- `verify-preview.sh 60` → `RESULT=pass` against the preview
  (https://tcg-ln8vvz26i-jontz.vercel.app), HTTP 200, mobile `overflowBy: 0`.
- **Independent surface re-audit on the preview.** A checker written from
  scratch for this verification (not the PR's code) sampled painted gutter
  pixels off real screenshots across 7 surfaces x 2 themes x 2 viewports = 28
  page loads. Result: **0 wrong samples**, every one. Dark bodies resolve to
  `oklch(0.18 0.005 260)`, light to `oklch(0.988 0.002 250)`. The issue's known
  offender, `/search`, is dark in dark and light in light.
- **Mutation test of the guard** against a local server, reusing the PR's own
  guard functions verbatim on a deliberately broken page:

  | injected bug | old body-level check | old contrast check | new guard |
  |---|---|---|---|
  | `main` paints hardcoded `#fff` | passes (misses it) | fails | **caught** |
  | `main` is a light `color-scheme` container with a themed bg | passes (misses it) | **passes, misses it** | **caught** |
  | results grid section paints light | passes (misses it) | fails | **caught** |
  | header paints light only | passes (misses it) | fails | **caught** |

  Row 2 is the important one: it is the exact shape the issue describes, it is
  invisible to every assertion that existed before this PR, and only the new
  guard catches it. That is the regression guard doing its job.
- `BASE_URL=http://localhost:3000 npm run theme:flows` → all assertions ok,
  `theme-flows: done`, exit 0, including the new painted-theme assertions on
  landing, search, search-prompt, search-empty, login, signup, 404, card detail,
  account and binder.
- Screenshots (committed under `docs/screenshots/`, linked as blob URLs since
  the repo is private):
  - Preview desktop: [issue-59-verify-preview-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-59/docs/screenshots/issue-59-verify-preview-desktop.png)
  - Preview mobile (390px): [issue-59-verify-preview-mobile.png](https://github.com/j0ntz/tcg-art/blob/jon/task-59/docs/screenshots/issue-59-verify-preview-mobile.png)
  - `/search` dark, the reported offender: [issue-59-verify-search-dark-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-59/docs/screenshots/issue-59-verify-search-dark-desktop.png)
  - `/search` light: [issue-59-verify-search-light-desktop.png](https://github.com/j0ntz/tcg-art/blob/jon/task-59/docs/screenshots/issue-59-verify-search-light-desktop.png)
  - The PR's own both-theme proof set for every surface, desktop and mobile:
    `docs/screenshots/issue-57-*`.

## Decisions (yolo defaults)

- **Deliverable 1 came back empty, and that is the right outcome.** The issue
  asked for token fixes on hard-coded surfaces. There are none left to fix; PR
  #58's token layer already did it, and the production evidence in the issue
  predates that merge. I confirmed this independently rather than taking the
  PR's word for it, which is why the surface re-audit above exists. Delivering
  the guard alone satisfies the acceptance criteria.
- **Reviewed with `event=COMMENT`**, since GitHub rejects a formal approval on a
  same-account PR. Routing is by change requests filed, of which there are none.

## Notes & follow-ups

- The painted guard runs at both viewports for the seven `SURFACES` entries, but
  only at desktop for card detail, account and binder. No live defect: I checked
  card detail at 390 in dark and it is correct. Worth closing the asymmetry the
  next time that file is touched, since the PR's own rationale for the mobile
  pass (containers that only exist below the `sm` breakpoint) applies equally to
  those three.
- `data-stage` on the zoom lightbox is currently inert, because no guard runs
  while the lightbox is open. It is correct as a contract and costs nothing.
- The 20%-of-viewport size floor is what keeps the ink-filled CTA and the avatar
  disc from being read as surfaces. A future full-width counter-theme band
  shorter than that floor would slip through check B, though check A's gutter
  sampling would still catch anything reaching the page edges.
