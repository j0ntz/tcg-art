# TCG-Art Orchestration Plan

Goal: a YOLO, hands-off, one-shot autonomous agent orchestration for a **Next.js webapp deployed on Vercel**, with the same eagerness as the existing Edge "sim dev" orchestration, but generalized for the web and kept on a **flat Claude subscription** (no per-token API billing).

This doc is the source of truth for how the orchestration is built. It is intentionally lighter than the Edge setup: solo project, commit-to-main, minimal ceremony.

---

## Action items

| # | Item | Status |
|---|------|--------|
| **A1** | **De-risk the Vercel deploy-verify chain (DO THIS FIRST).** Given a commit SHA, resolve its Vercel deployment URL, wait for `READY`, and confirm a headless browser (Playwright) can load it, handling Vercel deployment protection / auth if the deployment is protected. This is the **only** piece the research could not confirm against primary sources (verifier agents were rate-limited, not refuted, on every Vercel claim). Build nothing else around the loop until this works end to end. | todo |
| A2 | Create a new **Asana project** to manage this work. Decide whether to reuse the `agent_status` custom-field state machine from Edge or run lighter (e.g. plain sections / a simpler status field). | todo |
| A3 | **Strip Edge-specific restrictions** (see "Workflow simplifications" below): drop `lint-commit.sh`, the `/im` clean-commit discipline, the CHANGELOG gate, iOS sim + maestro, and yarn assumptions. Adopt commit-to-main with minimal ceremony. | todo |
| A4 | **Decide CI posture.** Default: Vercel build status only, no GitHub Actions (see "CI / GitHub Actions" below). Revisit GH Actions only if a standing regression suite is wanted later. | decided: skip GH Actions for now |
| A5 | **Port the control plane** (watcher / hooks / eval) keeping the agent **local + interactive + subscription-billed**. No `-p`, no Agent SDK, no `claude-code-action`. | todo |
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

## What ports / swaps / deletes / builds-new

| Edge piece | Action for tcg-art | Notes |
|---|---|---|
| `claude --yolo /one-shot <url>` interactive invocation | **Port as-is** | Subscription-billed; no change needed |
| PreToolUse / Stop enforcement hooks (deny AskUserQuestion + self-respawn, force-continue) | **Port as-is** | Native hooks, auto-loaded in interactive mode |
| Validator / eval subagents | **Port as-is** | Native subagents |
| Watcher / slot allocator (worktree) | **Port, simplified** | Worktree stays; drop sim + Metro allocation |
| `resolve-run` / `agent-eval` / `orch-eval` | **Port as-is** | Evidence sources change (Vercel deploy + PR), grading logic unchanged |
| iOS-sim pool refresh, Metro port mgmt, local build, `select-ios-sim.sh`, `ios-rn-build.sh` | **Delete** | Mac-specific; now Vercel's job |
| `build-and-test` (sim + maestro half) | **Swap implementation** | Keep the "drive the real action to terminal success + proof screenshot" contract; replace sim + maestro with resolve-deploy-URL + Playwright-against-deployment |
| `lint-commit.sh`, `/im` commit discipline, CHANGELOG gate | **Drop** | See workflow simplifications |
| maestro flows + proof screenshots | **Build new** | Playwright (or Claude-in-Chrome MCP) browser drive + `page.screenshot()` |
| Vercel deploy-URL resolution + protection bypass | **Build new (A1 spike)** | The only unconfirmed layer |

---

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
3. **Asana project shape** (A2): reuse the `agent_status` state machine or run lighter.
4. Whether to keep any PR-based preview flow at all, or go pure commit-to-main -> production.

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
