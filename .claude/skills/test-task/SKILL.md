---
name: test-task
description: Verify ONE Coded board task on its real Vercel preview, fix-on-fail, attach the Asana-style run report (preview link + screenshots + PR), then mark it Testing (auto-advancing to Review if primed). Fresh agent, not the one that built the feature. Invoked as `/test-task <issue-url>` by the Testing handler.
---

<goal>Take ONE Coded task (the GitHub issue passed as `/test-task <issue-url>`), verify the change on its deployed Vercel PREVIEW, fix the code if the preview is wrong, attach a run report to the board issue, then mark it Testing. If the task is primed for review (`auto-review` or `in-review` label), auto-advance it to Review. You are a FRESH agent: you did not write this code; verify it cold.</goal>

<rules>
<rule id="hands-off">Run in ONE turn, unattended (no AskUserQuestion). Before any Blocked you MUST run `/validate-block <issue-url> "<reason>"` and obey it: `legitimate: false` -> do its `what_to_try` and continue; only `legitimate: true` -> set Blocked, post ONE line naming the blocker, stop.</rule>
<rule id="scope">Work ONLY in the current worktree (your cwd, already on `jon/task-<n>` synced to origin). Commit + push to THIS branch. Never merge, tag, publish, or deploy.</rule>
<rule id="conventions">Follow this repo's CLAUDE.md (web TS standards, repo-local skills, plain `git commit`). Use npm; prefix `sfw` if your shell blocks bare npm/npx.</rule>
<rule id="verification-preview">Verify on the real Vercel PREVIEW, not just locally. Run `bash orchestration/verify-preview.sh <pr#> "<expected-substring>"` (pick an expected string that proves your change rendered). `RESULT=pass` is required and it writes `SCREENSHOT=<path>`. On `RESULT=fail`: read the output, fix the CODE, commit, push (re-triggers the preview), re-run verify-preview (up to ~3 rounds). Only a genuine wall after real attempts goes through `/validate-block`. State honestly what was verified; never claim more than `RESULT=pass` shows.</rule>
<rule id="run-report">On pass the board issue MUST carry a run report (the GitHub equivalent of Asana's attached agent-run-report). Fill `orchestration/templates/run-report.md`, commit it under `docs/run-reports/`, commit screenshots under `docs/screenshots/`, and post the report as an issue comment with the PR link and — prominently — the **live preview URL**. A bare "PR: <url>" comment is NOT sufficient.</rule>
</rules>

<step id="1" name="Read the task + resolve the PR">
Parse the issue number `<n>` from the prompt. `pr=$(gh pr list --repo j0ntz/tcg-art --head "jon/task-<n>" --state open --json number -q '.[0].number')`. If empty, `/validate-block` then Blocked ("no open PR to test"). Read `gh issue view <n>` and `gh pr view <pr>` to know what the change should do. Confirm `git branch --show-current` is `jon/task-<n>`.
</step>

<step id="2" name="Verify on the Vercel preview (fix-on-fail)">
Per `verification-preview`: run `bash orchestration/verify-preview.sh <pr> "<expected-substring>"`. If it fails, fix the code in this worktree, commit, push, and re-run until `RESULT=pass` or you hit a genuine wall (then validate -> Blocked). Note the `SCREENSHOT=<path>` it prints.
</step>

<step id="3" name="Run report">
Per `run-report`: copy the screenshot(s) into `docs/screenshots/`, fill `orchestration/templates/run-report.md` into `docs/run-reports/issue-<n>-<slug>.md` (every field; "_None._" for empty), commit + push both. Then post it on the issue so the board task carries it: `gh issue comment <n> --repo j0ntz/tcg-art --body-file docs/run-reports/issue-<n>-<slug>.md`. The report MUST lead with the live preview URL.
</step>

<step id="4" name="Mark Testing, then auto-advance if primed">
1. `bash orchestration/board.sh status <n> Testing`.
2. If the task is primed for review, advance it now: run
   `if bash orchestration/board.sh has-label <n> auto-review || bash orchestration/board.sh has-label <n> in-review; then bash orchestration/board.sh status <n> Review; fi`
   (the human moves Testing->Review manually when it is NOT primed).
3. Print a one-line final summary (issue, PR, RESULT, final state), then stop.
</step>
