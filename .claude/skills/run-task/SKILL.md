---
name: run-task
description: Autonomously take ONE board task (a GitHub issue) from Pending to a verified PR, hands-off, then mark it Done. Web/Next.js project with a GitHub Projects backend. Invoked as `/run-task <issue-url>` by the watcher.
---

<goal>Take ONE queued task (the GitHub issue passed as `/run-task <issue-url>`) from Pending to a verified PR, fully hands-off, then mark it Done on the board. Stop at PR; never merge.</goal>

<rules>
<rule id="hands-off">Run in ONE turn, no interactive questions (you are unattended; AskUserQuestion is not available). On a genuine true-blocker (missing credential, destructive op with no safe default, irreducible ambiguity that could flip the outcome), set the board to Blocked, post ONE line on the issue naming the blocker, and stop. Everything else: pick a defensible default and proceed.</rule>
<rule id="scope">Work ONLY in the current worktree (your cwd). Do not touch other repos or main checkouts. Commit to THIS branch.</rule>
<rule id="conventions">Follow this repo's CLAUDE.md (web TS standards, repo-local skills, plain `git commit`). Use npm (the repo's package manager). If your shell blocks bare npm/npx, prefix with `sfw` (e.g. `sfw npm run build`).</rule>
<rule id="stop-at-pr">Open a PR and stop. NEVER merge, tag, publish, or deploy.</rule>
<rule id="verification-preview">Verify on the real Vercel PREVIEW deployment, not just locally. (1) Before opening the PR, run `npm run build` as a sanity gate (never open a PR on a broken build). (2) After the PR is open, Vercel auto-builds a preview; run `bash orchestration/verify-preview.sh <pr#> "<expected-substring>"` — it resolves the preview URL, asserts it is live (HTTP 200, not an error/SSO page), and captures a screenshot. `RESULT=pass` is required. Commit the screenshot it produced into the branch and reference it (plus the preview URL) in the PR's Test Evidence section. State honestly what was verified; never claim more than `RESULT=pass` shows.</rule>
<rule id="run-report">On completion the board task (issue) MUST carry a run report — the GitHub equivalent of Asana's attached agent-run-report. Fill `orchestration/templates/run-report.md`, commit it under `docs/run-reports/`, and post it as an issue comment, alongside the screenshots (committed under `docs/screenshots/` + blob-linked), the PR link, and — prominently — the **live preview URL** (so the operator can click straight to the deployed change, not production). A bare "PR: <url>" comment is NOT sufficient.</rule>
</rules>

<step id="1" name="Read the task">
Parse the issue number from the `/run-task <issue-url>` prompt. Run `gh issue view <n> --repo j0ntz/tcg-art --json title,body`. Read the docs it references (docs/spec.md, docs/screenshots/, and ~/pokemon-artfinder-scrape-and-spec.md if mentioned). Confirm your location: `git rev-parse --show-toplevel` (should be this worktree) and `git branch --show-current`.
</step>

<step id="2" name="Mark Running">
`bash orchestration/board.sh status <n> Running` (idempotent; the watcher may have set it already).
</step>

<step id="3" name="Implement">
Do the task to its definition of done, following CLAUDE.md. Commit cleanly with plain `git commit` (no lint-commit wrapper here).
</step>

<step id="4" name="Local build sanity">
Run `npm run build` (prefix `sfw` if your shell requires it). It must pass before you open a PR; if it fails, fix and re-run (up to ~2 attempts). This is a gate, not the full verification — that happens on the deployed preview in step 6.
</step>

<step id="5" name="PR">
Push the branch and `gh pr create --repo j0ntz/tcg-art --base main --head <branch> --title "<concise>" --body "<body>"`. The body MUST include `Closes #<n>`, a short change summary, and a **Test Evidence** section (prose + screenshot path if captured). Do not merge.
</step>

<step id="6" name="Verify on the Vercel preview">
Per `verification-preview`: run `bash orchestration/verify-preview.sh <pr#> "<expected-substring>"` (choose an expected string that proves your change rendered). It resolves the PR's preview URL, asserts it is live, and writes a screenshot (`SCREENSHOT=<path>`). On `RESULT=pass`: copy the screenshot into `docs/screenshots/`, commit + push it, and add/refresh a **Test Evidence** section in the PR body linking it and naming the preview URL. On `RESULT=fail`: read the output, fix the code, push (which re-triggers the preview), and re-run verify-preview until it passes — or, if it's a genuine wall, set Blocked.
</step>

<step id="7" name="Run report + Mark Done">
Per `run-report`, attach the report to the board task, THEN mark Done:
1. Fill `orchestration/templates/run-report.md` into `docs/run-reports/issue-<n>-<slug>.md` (every field; "_None._" for empty ones). Commit + push it, along with the screenshots under `docs/screenshots/`.
2. Post it on the issue so the board task carries it: `gh issue comment <n> --repo j0ntz/tcg-art --body-file docs/run-reports/issue-<n>-<slug>.md`.
3. `bash orchestration/board.sh status <n> Done`.
4. Print a one-line final summary, then stop.
</step>
