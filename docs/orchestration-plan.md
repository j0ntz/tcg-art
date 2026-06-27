# TCG-Art Orchestration Plan

Goal: a YOLO, hands-off, one-shot autonomous agent orchestration for a **Next.js webapp deployed on Vercel**, with the same eagerness as the existing Edge "sim dev" orchestration, but generalized for the web and kept on a **flat Claude subscription** (no per-token API billing).

This doc is the source of truth for how the orchestration is built. It is intentionally lighter than the Edge setup: solo project, commit-to-main, minimal ceremony.

---

## Action items

| # | Item | Status |
|---|------|--------|
| **A1** | **De-risk the Vercel deploy-verify chain (DO THIS FIRST).** Given a commit SHA, resolve its Vercel deployment URL, wait for `READY`, and confirm a headless browser (Playwright) can load it, handling Vercel deployment protection / auth if the deployment is protected. This is the **only** piece the research could not confirm against primary sources (verifier agents were rate-limited, not refuted, on every Vercel claim). Build nothing else around the loop until this works end to end. | todo |
| A2 | **Task backend = GitHub Projects (done).** Board "Agent Orchestration" (#1, private), custom single-select **Agent Status** (Pending/Running/Blocked/Done). First task queued: tcg-art#1, Agent Status = Pending. See "Task backend" below. | done |
| A3 | **Strip Edge-specific restrictions** (see "Conventions" + "Workflow simplifications" below): drop `lint-commit.sh`, the `/im` clean-commit discipline, the CHANGELOG gate, iOS sim + maestro, and yarn assumptions. Adopt commit-to-main with minimal ceremony. | in progress: `CLAUDE.md` overrides written |
| A4 | **Decide CI posture.** Default: Vercel build status only, no GitHub Actions (see "CI / GitHub Actions" below). Revisit GH Actions only if a standing regression suite is wanted later. | decided: skip GH Actions for now |
| A5 | **Stand up the orchestration repo-local** (fresh and lighter; see "Orchestration home" below). Reuse the global enforcement hooks as-is; rebuild `one-shot` + the verify step fresh in this repo. Agent stays **local + interactive + subscription-billed** (no `-p` / Agent SDK / `claude-code-action`). | decided: start anew, repo-local |
| A6 | **Build the new verify step**: browser-drive the Vercel deployment for the real user flow to terminal success, capture a screenshot, attach as proof. Replaces the iOS-sim + maestro half of `build-and-test`. | todo |
| A7 | **Scaffold the Next.js app** itself in this repo. | todo |

---

## Billing constraint (the decisive factor)

Staying on the flat Claude subscription rules out the cloud-native and "agent-in-CI" hybrid models, because both require a pay-per-token API key. Verified against current Claude docs:

| Execution path | Auth | Billing |
|---|---|---|
| Interactive `claude` (incl. `--yolo` + initial `/one-shot`, run in tmux) | Subscription OAuth | Flat fee (keep) |
| `claude -p` headless | Subscription if no API key set | Flat fee today, but targeted by a paused 2026-06-15 change that would move headless `-p` to a separate API-rate credit pool. Avoid as a hedge. |
| Agent SDK (`query()`) | API key required | Pay-per-token (avoid) |
| `claude-code-action` / GitHub Actions running Claude | API key required (no subscription option) | Pay-per-token (avoid) |

Decision: the agent runs **locally, interactively, exactly like the current Edge invocation** (`claude --yolo /one-shot <task>` in tmux). This is the only path that stays on the subscription. `-p` is avoided as a hedge against the paused billing change; it is not needed anyway, since the interactive-with-initial-command pattern already runs hands-off.

Consequence: `--bare` mode is irrelevant here (it only applies to `-p` / SDK). Hooks auto-load from `~/.claude` in interactive mode exactly as they do today.

---

## Hosting model decision

Chosen: **self-hosted local agent + Vercel for build/host + local browser for verify.**

The Edge orchestration is self-hosted for one reason only: iOS simulators need a Mac. A Next.js build has no such dependency, and Vercel already builds and hosts a deployment on every push. So the two heaviest local subsystems disappear:

- iOS-sim pool + Metro port + local build -> deleted (Vercel owns build + hosting).
- The local agent simply browser-drives the **remote** Vercel URL.

Cloud-native (`claude-code-action`) and "move the agent into GitHub Actions" were rejected purely on billing (API key required). They are revisitable only if per-token billing becomes acceptable.

---

## Orchestration home: start anew (repo-local), reuse only the generic core

Decision (recommended): **build the web orchestration fresh and commit it into this repo (repo-local `.claude/` skills + settings + `scripts/`). Reuse only the genuinely generic, already-global pieces of the Edge arch. Do NOT generalize the Edge `one-shot` / `build-and-test` / watcher skills into a multi-flavor system.**

Why not refactor the existing Edge arch into a shared multi-target system:

- **Deep Edge coupling, and we are stripping the parts that carry its value.** The Edge skills are saturated with Edge specifics (Asana custom-field state machine, edge-react-gui dep integration, iOS sim + maestro, multi-repo subtasks, reviewer-bot finalize-gate, test-fund discipline). This project drops most of that (commit-to-main, no lint-commit, no CHANGELOG gate, no multi-repo, no GH Actions). A shared path would be mostly Edge-logic-removed-for-web: a conditional-soup skeleton sharing little real behavior.
- **Shared philosophy, not shared implementation.** Both are eager / hands-off / hook-enforced, but the implementations diverge (RN + iOS + maestro + multi-repo vs Next + Vercel + browser + single-repo). When things share principles but not code, copy the principles, not the code. Premature DRY across diverging domains buys coupling for near-zero reuse.
- **Isolation.** A repo-local orch for a solo project cannot regress the production Edge pipeline (which runs every 120s and is graded by the eval layer).
- **Reproducibility for free.** The orch is version-controlled with the app: clone the repo, get the orch.

Refactor-existing would only win if a third web-similar target were expected soon (amortize the abstraction), or this project wanted to keep all the heavy Edge gates, or one eval rubric was needed across both. None hold, so start-anew wins. Revisit extracting a shared core only if that third target appears.

What to reuse vs rebuild:

| Edge piece | For tcg-art | Why / note |
|---|---|---|
| Enforcement hooks (deny AskUserQuestion / self-respawn, Stop force-continue) | **Reuse as-is** (stay global, gated on `AGENT_TASK_GID`) | Already repo-agnostic; highest-value shared asset; encodes the fork-storm / no-respawn prevention. Do not fork. |
| Global always-apply rules (act-autonomously, answer-questions-first, workflow-halt-on-error, writing-style) | **Reuse as-is** | Generic; apply fine anywhere. (`no-format-lint`'s lint-commit specifics load but stay inert without the script.) |
| `claude --yolo /one-shot <task>` interactive invocation | **Reuse pattern as-is** | Subscription-billed; the invocation does not change |
| `one-shot` phase-machine *skill* | **Rebuild fresh, repo-local + lighter** | Keep the phase skeleton; collapse phases, commit-to-main. Do not fork the dense Edge file. |
| `build-and-test` | **Rebuild fresh** (Vercel + browser verify) | Keep only the contract: drive the real action to terminal success + proof screenshot |
| Vercel deploy-URL resolution + protection bypass | **Build new (A1 spike)** | The only unconfirmed layer |
| Browser drive + proof | **Build new** | Playwright (or Claude-in-Chrome MCP) drive + `page.screenshot()` |
| Watcher / watchdog daemon + slot/pool allocator | **Copy-adapt later (optional)** | Reuse the poll -> allocate -> spawn -> tend pattern; slot loses sim/Metro. Not needed day 1: manually kicking `claude --yolo /one-shot <task>` works until auto-pickup is wanted. |
| Eval layer (resolve-run / agent-eval / orch-eval) | **Copy-adapt later** | Pattern reusable; the rubric is Edge-process-specific, rewrite for web. Not needed day 1. |
| `im` / `pr-create` / `pr-land` / `lint-commit` / `changelog` | **Drop** | Edge ceremony being removed |
| iOS-sim pool refresh, Metro mgmt, local build, `select-ios-sim.sh`, `ios-rn-build.sh` | **Delete** | Mac-specific; now Vercel's job |
| Task backend (was Asana) | **GitHub Projects (done)** | Native board + Agent Status field; data lives in GitHub. See "Task backend". |

Minor wrinkle to watch: the global always-apply rules and hooks fire in *every* session, including tcg-art. That is desired for the hooks and the generic rules; the few Edge rules that would misfire here are redirected by `CLAUDE.md` (see "Conventions" below).

---

## Disk layout & sync

The orchestration lives in this repo (repo-local `.claude/`), synced by plain git. No bootstrap, no convention-sync, no symlinks.

```
tcg-art/
├── CLAUDE.md                     # project instructions + Edge-rule overrides (committed)
├── .claude/
│   ├── settings.json             # project settings + project hooks (committed)
│   ├── settings.local.json       # machine-local secrets/overrides (gitignored)
│   ├── skills/<skill>/SKILL.md    # repo-local web skills (committed)
│   └── agents/                   # validator/eval subagents, if/when added
├── scripts/                      # companion scripts (committed)
├── docs/orchestration-plan.md
└── ...the Next.js app...
```

- **Discovery is by working directory.** Claude Code auto-loads `.claude/` when cwd is this repo. Gotcha: the agent must be launched from INSIDE the repo or its worktree (`cd <repo-or-worktree> && claude --yolo /one-shot <task>`), or `.claude/` is invisible and `/one-shot` falls through to the global Edge skill. Launch-from-home (the Edge watcher's `~/git` pattern) does NOT work here.
- **Sync = git.** Clone or pull the repo and the orch comes with it. That is the whole sync story.
- **Reused enforcement hooks stay global**, gated on `AGENT_TASK_GID`. They are NOT copied into the repo; the spawn sets that env var to light them up.
- **convention-sync overlap: none, by one rule.** convention-sync walks `~/.cursor/` only. NEVER author tcg-art skills under `~/.cursor/skills/`: if you do, convention-sync sweeps them into edge-dev-agents AND they apply globally to Edge sessions. Keep them in `tcg-art/.claude/skills/`.

## Conventions: dropped / overridden from Edge

`CLAUDE.md` carries the repo-local overrides (project instructions win over the global Edge rules). Summary:

**Overridden (global rules that would otherwise misfire here):**
- `load-standards-by-filetype` -> use the slim "Web TypeScript standards" in `CLAUDE.md`, not the Edge `typescript-standards.mdc` (which enforces `lstrings`, `cacheStyles`, `biggystring`, `cleaners`, Redux selectors, and Edge ESLint recipes - none of which exist here). Kept ~2/3 of it as generic TS/React hygiene; dropped the Edge-mechanism third.
- `no-format-lint` -> no `lint-commit.sh` / `yarn` here; use the app's package manager (npm/pnpm) + its ESLint/Prettier, plain `git commit`, fix formatting directly.
- `slash-command-detection` (in `workflow-halt-on-error`) -> resolve `/<command>` from repo-local `.claude/skills/` first, NOT `~/.cursor/skills/` (otherwise `/one-shot` here loads the heavy Edge skill).

**Kept (generic, useful):** `act-autonomously`, `answer-questions-first`, `writing-style` (em-dash + no-slop), the enforcement hooks.

**Dropped outright:** `lint-commit.sh`, `/im` commit discipline, CHANGELOG gate, `eslint-warnings.mdc`, `review-standards.mdc`, yarn assumptions (use npm/pnpm), `develop` base branch (use `main`), the Asana `agent_status`/`tested`/`blocked` state machine (simpler or none, A2), `GIT_BRANCH_PREFIX` naming, multi-repo subtasks / dep-pr. The reviewer-bot finalize-gate (`cursor[bot]`) applies only if Cursor Bugbot is actually run on this repo.

---

## Task backend (GitHub Projects)

The orch's queue + state store is **GitHub Projects** (native, first-party; task data lives in GitHub). No Asana, no DB, no custom board. GitHub Projects is a GitHub feature, not a third-party developer's board, so it clears the security bar.

- Board: "Agent Orchestration" (user-level, private) - https://github.com/users/j0ntz/projects/1 (project #1, id `PVT_kwHOD6Er384BbyER`).
- State: custom single-select **Agent Status** field, state machine **Pending → Running → [Blocked] → Done → Land → Landed**. Done = PR open + verified, awaiting your review; you move Done → **Land** to approve merging, and the lander sets **Landed**. (Option IDs live in `orch.config.json`. Editing the option set via the API *recreates all option IDs* and clears existing items' values — snapshot statuses first, then refresh the config IDs and restore.)
- Lander (`land.sh` + `/land-task`, runs each tick): one Land task per tick (sequential — each merge moves `main`, the next rebases onto it). **Clean rebase → deterministic squash-merge inline** (no LLM). **Conflict → spawn a `/land-task` agent that resolves it SEMANTICALLY** (merge both intents; regenerate lockfiles), verifies the build, then squash-merges — no blocking on conflicts. Only a genuine NON-conflict failure (merge rejected, build unfixable) → **Blocked**. Follow-up: have the watchdog also frozen-sweep `claude-land-*` sessions.
- Tasks are GitHub issues (in the relevant project repo) added as board items; one user-level board spans every project repo.
- Access: `gh` CLI with the `project` scope, added to the keyring login (`GITHUB_TOKEN` in `~/.zshrc` mirrors that token via `gh auth token`, so it inherits the scope on a new shell).
- Loop: the watcher polls `gh project item-list` for Agent Status = Pending; the agent flips the field via `gh project item-edit`, comments on the issue, and links its PR (auto-closes the issue on merge).
- You add tasks by opening an issue (GitHub mobile works) and dropping it on the board.

## Verification bar

"Done" requires both signals:

1. **Vercel build green** (the app compiled and deployed). Automatic via Vercel's Git integration. No GitHub Actions involved.
2. **Agent browser-drives the real user flow** against the deployed URL to terminal success, with a screenshot as proof. Run by the local agent (Playwright MCP for scripted/deterministic flows; Claude-in-Chrome MCP for exploratory). The local agent can also run `tsc` / unit tests before pushing.

CI-green alone is not sufficient. The actual browser drive is the bar.

---

## CI / GitHub Actions

Decision: **skip GitHub Actions for now.**

Clarification of the confusion that prompted this:

- **Vercel runs the build "CI" automatically.** Pushing triggers `next build` + deploy; success/failure posts as a commit status. This needs zero GitHub Actions.
- **GitHub Actions is a separate, optional runner** for checks Vercel's build does not run on its own (lint, typecheck, unit tests, Playwright E2E). It is **not** what builds the Vercel deployment.
- For this project the agent runs `tsc` / unit tests locally before pushing and does the real browser drive itself, so there is nothing left for GitHub Actions to do.

The only reason to add GitHub Actions later: a **persistent, deterministic regression suite** (Playwright tests that accumulate and run on every push, independent of any agent run, as a safety net). That is a later option, not foundational.

Note on billing separation: GitHub Actions minutes are GitHub's compute billing (free on public repos; a monthly allotment then ~per-minute on private, Linux x1 / macOS x10). They are unrelated to Claude billing. Running plain Playwright in Actions costs only Actions minutes. Running Claude in Actions is what would require an API key (avoided).

---

## Workflow simplifications (vs Edge)

- **Commit to main.** Mostly commit directly to `main`; PR ceremony is optional, used only when a change is worth isolating.
- **Drop `lint-commit.sh`.** No forced `eslint --fix` commit wrapper. Plain `git commit`.
- **Drop the `/im` clean-commit discipline, CHANGELOG gate, and the Asana<->GitHub widget attach flow.** Keep commits readable but unceremonious.
- **Drop iOS / RN / yarn assumptions.** This is a Next.js app; use its package manager and the web verify path.

### Deployment-flow nuance (affects A1)

Committing to `main` means Vercel deploys to **production** (typically a public URL, no auth gate), not a protected preview. So:

- "Resolve the deployment for this commit SHA and wait for `READY`" is **always** needed (the agent must drive the new deployment, not a stale one).
- "Bypass Vercel deployment protection" is needed **only** for protected **preview** deployments. If the loop stays commit-to-main -> public production, the protection-bypass half may not be needed at all.

The A1 spike should cover both: SHA -> deployment URL -> wait `READY` (always), plus the protection-bypass header/cookie path (only if previews are protected). Confirm current Vercel bypass mechanics against live docs.

---

## Open questions / to confirm

1. **Vercel deploy-URL resolution + protection bypass** mechanics against live Vercel docs (the A1 spike). The research pool's claims on `x-vercel-protection-bypass`, `VERCEL_AUTOMATION_BYPASS_SECRET`, the bypass cookie, and `wait-for-deployment` actions were rate-limited in verification, not confirmed.
2. **Playwright MCP vs Claude-in-Chrome MCP** for the proof drive against a (possibly protected) deployment: auth / headless limits of each.
3. **(resolved)** Task backend = GitHub Projects (Agent Orchestration board #1); see "Task backend".
4. Whether to keep any PR-based preview flow at all, or go pure commit-to-main -> production.
5. **Stack conventions to lock** as the app takes shape (record in `CLAUDE.md`): styling (CSS modules / Tailwind / styled), data fetching (App Router server components vs client TanStack Query), state (Context / Zustand).

---

## Sources

- Claude Agent SDK: https://code.claude.com/docs/en/agent-sdk/overview
- Hooks: https://code.claude.com/docs/en/hooks
- Headless / `-p`: https://code.claude.com/docs/en/headless
- Subagents: https://platform.claude.com/docs/en/agent-sdk/subagents
- GitHub Actions for Claude Code: https://code.claude.com/docs/en/github-actions
- `claude-code-action`: https://github.com/anthropics/claude-code-action
- Claude Code auth/billing precedence: https://code.claude.com/docs/en/authentication
- Claude Code with Pro/Max plans: https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- Vercel deployment-protection bypass: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- Claude-in-Chrome MCP: https://code.claude.com/docs/en/chrome
