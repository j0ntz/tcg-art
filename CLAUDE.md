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

Stack conventions to lock as the app takes shape (record the chosen one here once decided): styling (CSS modules / Tailwind / styled), data fetching (App Router server components vs client TanStack Query), and state (Context / Zustand).
