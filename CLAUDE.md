# tcg-art

Next.js webapp deployed on Vercel, built and maintained by a hands-off agent orchestration. See [docs/orchestration-plan.md](docs/orchestration-plan.md) for the orchestration design and decisions.

## This repo overrides the global Edge rules

The machine's global rules and `~/.claude/CLAUDE.md` are tuned for the Edge React Native app. This repo is a standalone Next.js webapp with none of that tooling. Where they conflict, THESE project instructions win.

1. **Skill resolution.** Resolve `/<command>` from this repo's `.claude/skills/<command>/SKILL.md` first. Do NOT load the Edge skill of the same name from `~/.cursor/skills/` (the global `slash-command-detection` rule points there; ignore it here). `/one-shot` in this repo means this repo's lighter web one-shot, not the Edge one.
2. **TypeScript standards.** For `.ts`/`.tsx` edits follow the "Web TypeScript standards" below, NOT `~/.cursor/rules/typescript-standards.mdc`. The Edge standards enforce Edge-only systems (`lstrings` localization, `cacheStyles` React Native styling, `biggystring` crypto math, the `cleaners` library, Redux selectors, Edge custom ESLint recipes); none of those exist here.
3. **Formatting and lint.** The global `no-format-lint` rule assumes an `eslint --fix` commit hook (`lint-commit.sh`) and `yarn`. This repo has neither. Use the project's package manager (npm or pnpm, per the lockfile) and its own ESLint/Prettier config, with plain `git commit` (no lint-commit wrapper). Running the formatter and fixing formatting directly is fine and expected.

Generic global rules still apply and are welcome: `act-autonomously`, `answer-questions-first`, `writing-style` (em-dash scoping + no-slop), and the hands-off enforcement hooks (gated on `AGENT_TASK_GID`).

## Web TypeScript standards

Apply to every `.ts`/`.tsx` edit:

- No `any`. Define a type or interface; if genuinely unavoidable, add a comment explaining why.
- Catch callbacks type the error as `unknown`: `catch (e: unknown)` and `.catch((e: unknown) => ...)`. No empty catches that swallow errors (exception: an expected user cancellation with nothing to clean up).
- No optional chaining used directly in a condition: write `if (obj?.prop != null)`, not `if (obj?.prop)`.
- Use `??` not `||` for default values (preserves `0` and `''`).
- Prefer flat boolean expressions. No redundant fall-through branches. No wrapper handlers that only forward to another function.
- Any `useEffect` that creates a timer, interval, or subscription must return a cleanup.
- Memoize derived arrays/objects (`Object.values`, `.filter`, `.map`) when the result feeds a dependency array or is passed as a prop.
- React list keys must include a required unique field or the array index, never only optional fields.
- Pre-compute expensive transforms outside loops.
- Descriptive variable names. Comments explain why (not what) and document the current state, not change history.
- Components: `const C: React.FC<Props> = props => {...}`.

## Design system (binding for all UI work)

`docs/design-system.md` is the design contract and `app/globals.css` is the
token source of truth; `docs/research/anti-slop-ui.md` lists the banned
patterns, which are merge gates. The short version every UI edit must honor:

- Two typefaces only: Bricolage Grotesque (display, `font-display`) + IBM
  Plex Sans (body). Never add a family; never reintroduce
  Inter/Roboto/Geist/system stacks. NO SERIFS anywhere (product decision:
  the serif/editorial flavor is rejected); no italics either — the contrast
  axis is weight (light vs bold/extrabold), not slant.
- One dominant (cool "ink" gallery neutrals) + one accent ("ember" orange),
  OKLCH tokens only. The ember accent has a hard budget of 5 placements
  site-wide (listed in globals.css); do not spend it without removing a
  placement. Components consume semantic tokens (`surface`, `foreground-*`,
  `border`, `primary`), never primitives or hex.
- **Light and dark are both first-class**, and the default is the user's
  system preference. Every semantic token is `light-dark(light, dark)` in
  `globals.css`, selected by `color-scheme` on `<html>` (no attribute =
  system; `data-theme="light"|"dark"` = the cookie-backed override the server
  stamps). Therefore: NO hardcoded colors in components (no hex, no
  `bg-white`/`text-black`, no Tailwind palette shades), NO `dark:` utilities,
  and a new semantic token needs BOTH values. The only single-valued tokens
  are the fixed near-black STAGE set (`surface-night*`, `foreground-inverse*`,
  `border-inverse`, `surface-mat`, `foreground-on-mat*`, `primary-bright`)
  used by the hero, Night Gallery, and zoom lightbox. Card art is never
  filtered or tinted by either theme.
- `package.json`'s `browserslist` is load-bearing: below Chrome 123 / Safari
  17.5 Lightning CSS silently downlevels every token to its light branch,
  killing the dark theme with no build error. Do not remove or lower it.
- Energy-type colors (`--color-type-*`) are FUNCTIONAL data ink: they may
  appear only on elements naming that energy type (the `TypeBadge`
  primitive, future type facets), never as decoration or theming. Psychic
  purple is a functional exception to the no-purple rule, not a brand color.
- No gradients, glows, colored shadows, badges/kickers above H1s, icon-grid
  feature cards, emoji-as-icons, cards-in-cards, ALL-CAPS letter-spaced
  labels, or centered-everything. Layout voice is the left-aligned hairline
  ledger.
- Radius scale is exactly field (8px) / card (16px) / pill; shadows neutral.
- Motion: interaction-tied micro-transitions plus the one scroll-linked hero
  fan; no load/scroll-in reveals or staggers; respect reduced motion.
- States first: any new data surface ships loading/empty/error designs and
  keeps the global `:focus-visible` ring (no `outline-none`).
- Vision loop: screenshot desktop+mobile (plus states) IN BOTH THEMES, audit
  against the banned list, fix, re-screenshot, before calling UI work done.
  `npm run theme:flows` (against a running dev server) automates the theme
  half: contrast, un-tinted art, persistence, no-flash, mobile header.

Stack conventions (locked in Phase 0; revisit as the app grows):

- **Styling:** Tailwind CSS v4.
- **Data fetching:** App Router server components fetching server-side. No client data library yet; add TanStack Query only if client-side fetching becomes necessary.
- **State:** none yet (no client state library). Add Zustand or Context when a real client-state need appears.
