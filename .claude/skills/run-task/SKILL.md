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
<rule id="verification-prose">Verification is a PROSE bar for now (deployed Vercel-preview verification is deferred and will be wired later). Confirm the app BUILDS (`npm run build`), run it locally (`npm run dev`) and confirm the changed page renders correctly (capture a screenshot with the browser/preview tools if available), then write an honest Test Evidence section stating exactly what you checked and what you did NOT (e.g. "verified local build + dev render; NOT verified on a deployed Vercel preview"). Never claim more than you verified.</rule>
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

<step id="4" name="Verify (prose bar)">
Per `verification-prose`: `npm run build` must pass; run `npm run dev` and confirm the changed page renders (screenshot if you can drive a browser). If the build fails, fix and re-verify (up to ~2 attempts) before opening a PR. Record what you verified.
</step>

<step id="5" name="PR">
Push the branch and `gh pr create --repo j0ntz/tcg-art --base main --head <branch> --title "<concise>" --body "<body>"`. The body MUST include `Closes #<n>`, a short change summary, and a **Test Evidence** section (prose + screenshot path if captured). Do not merge.
</step>

<step id="6" name="Mark Done">
`bash orchestration/board.sh status <n> Done`. Comment the PR URL on the issue: `gh issue comment <n> --repo j0ntz/tcg-art --body "PR: <url>"`. Print a one-line final summary, then stop.
</step>
