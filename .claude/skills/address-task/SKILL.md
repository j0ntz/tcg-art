---
name: address-task
description: Address the review comments on ONE Address-state board task's PR (fix code + reply to threads + push), then re-enter the pipeline at Coded so it re-tests and re-reviews. Loop caps at 2 rounds, then validates and Blocks. Fresh agent. Invoked as `/address-task <issue-url>` by the Address handler. Repo-local; do NOT load the Edge `/pr-address`.
---

<goal>Address the latest review on ONE task's PR (the GitHub issue passed as `/address-task <issue-url>`): make the code fixes, reply to each thread, push, then set the board back to Coded so the Testing handler re-verifies and the loop re-reviews. Bail to Blocked (validated) only if the review loop will not converge.</goal>

<rules>
<rule id="hands-off">Run in ONE turn, unattended. Before any Blocked you MUST run `/validate-block <issue-url> "<reason>"` and obey it.</rule>
<rule id="scope">Work ONLY in the current worktree (on `jon/task-<n>`, synced to origin). Commit + push to THIS branch. Never merge.</rule>
<rule id="conventions">Follow this repo's CLAUDE.md (web TS standards, plain `git commit`). Use npm; prefix `sfw` if your shell blocks bare npm/npx.</rule>
<rule id="loop-cap">This is a bounded loop. Count prior address rounds by counting issue comments that contain the marker `<!-- address-round -->`. If 2 rounds have already happened, do NOT address again: run `/validate-block <issue-url> "review loop did not converge after 2 address rounds"` (this is a legitimate external wall) and set Blocked. Otherwise this is round N = priorRounds + 1.</rule>
</rules>

<step id="1" name="Read the review + check the loop cap">
Parse `<n>`. `pr=$(gh pr list --repo j0ntz/tcg-art --head "jon/task-<n>" --state open --json number -q '.[0].number')`. Read the latest `<!-- review-task -->` comment (`gh pr view <pr> --comments` / `gh issue view <n> --comments`) for the BLOCKING findings. Apply `loop-cap`: count `<!-- address-round -->` markers; if >= 2, validate -> Blocked and stop.
</step>

<step id="2" name="Address each blocking finding">
For every BLOCKING finding: make the minimal correct fix in this worktree following CLAUDE.md, and `git commit`. If a finding is wrong or not applicable, do not change code for it but record why in step 4. Run `npm run build` (sfw if needed) as a sanity gate before pushing.
</step>

<step id="3" name="Push">
`git push` the fixup commits to `jon/task-<n>` (re-triggers the Vercel preview build that Testing will verify).
</step>

<step id="4" name="Reply + mark the round">
Post ONE issue comment via `gh issue comment <n> --repo j0ntz/tcg-art --body-file <file>` (editor, not heredoc) that starts with the marker `<!-- address-round -->` and lists, per finding: addressed (commit/what) or declined (why). This both replies to the reviewer and increments the loop counter.
</step>

<step id="5" name="Re-enter at Coded">
`bash orchestration/board.sh status <n> Coded`. The Testing handler re-verifies the new HEAD; because `in-review` is set, Testing auto-advances to Review for another pass. Print a one-line summary (issue, PR, round, fixes), then stop.
</step>
