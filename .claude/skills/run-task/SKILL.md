---
name: run-task
description: Autonomously take ONE board task (a GitHub issue) from Pending to an open PR with a passing build, hands-off, then mark it Coded. Web/Next.js project with a GitHub Projects backend. Invoked as `/run-task <issue-url>` by the watcher. Verification + run report happen later in the Testing stage, not here.
---

<goal>Take ONE queued task (the GitHub issue passed as `/run-task <issue-url>`) from Pending to an open PR whose local build passes, fully hands-off, then mark it Coded on the board. Stop at PR; never merge. Preview verification and the run report are the Testing stage's job, not yours.</goal>

<rules>
<rule id="hands-off">Run in ONE turn, no interactive questions (you are unattended; AskUserQuestion is not available). Before setting the board to Blocked you MUST run `/validate-block <issue-url> "<your reason>"` and obey its verdict: on `legitimate: false`, do its `what_to_try` and continue; only on `legitimate: true` set Blocked, post ONE line on the issue naming the blocker, and stop. Everything else: pick a defensible default and proceed.</rule>
<rule id="scope">Work ONLY in the current worktree (your cwd). Do not touch other repos or main checkouts. Commit to THIS branch.</rule>
<rule id="conventions">Follow this repo's CLAUDE.md (web TS standards, repo-local skills, plain `git commit`). Use npm (the repo's package manager). If your shell blocks bare npm/npx, prefix with `sfw` (e.g. `sfw npm run build`).</rule>
<rule id="stop-at-pr">Open a PR and stop. NEVER merge, tag, publish, or deploy. NEVER verify on the preview or write the run report here (that is the Testing stage).</rule>
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
Run `npm run build` (prefix `sfw` if your shell requires it). It MUST pass before you open a PR; if it fails, fix and re-run (up to ~2 attempts). This is the only gate at this stage; deployed-preview verification happens in Testing.
</step>

<step id="5" name="PR">
Push the branch and `gh pr create --repo j0ntz/tcg-art --base main --head <branch> --title "<concise>" --body "<body>"`. The body MUST include `Closes #<n>`, a short change summary, and a **Test Evidence** section stating "Local build passes; preview verification pending in the Testing stage." Do not merge.
</step>

<step id="6" name="Mark Coded">
`bash orchestration/board.sh status <n> Coded`. Print a one-line final summary (issue, branch, PR url), then stop. The Testing handler picks it up from here.
</step>
