---
name: address-task
description: Address the change requests on ONE Address-state board task's PR (fix code + reply to and RESOLVE each review thread + push), then re-enter the pipeline at Coded so it re-tests and re-reviews. Loop caps at 2 rounds, then validates and Blocks. Fresh agent. Invoked as `/address-task <issue-url>` by the Address handler. Repo-local; do NOT load the Edge `/pr-address`.
---

<goal>Address the latest review on ONE task's PR (the GitHub issue passed as `/address-task <issue-url>`): make the code fix for every change request, reply to and RESOLVE each review thread, push, then set the board back to Coded so the Testing handler re-verifies and the loop re-reviews. Bail to Blocked (validated) only if the review loop will not converge.</goal>

<rules>
<rule id="hands-off">Run in ONE turn, unattended. Before any Blocked you MUST run `/validate-block <issue-url> "<reason>"` and obey it.</rule>
<rule id="scope">Work ONLY in the current worktree (on `jon/task-<n>`, synced to origin). Commit + push to THIS branch. Never merge.</rule>
<rule id="conventions">Follow this repo's CLAUDE.md (web TS standards, plain `git commit`). Use npm; prefix `sfw` if your shell blocks bare npm/npx.</rule>
<rule id="loop-cap">This is a bounded loop. Count prior address rounds by counting issue comments that contain the marker `<!-- address-round -->`. If 2 rounds have already happened, do NOT address again: run `/validate-block <issue-url> "review loop did not converge after 2 address rounds"` (this is a legitimate external wall) and set Blocked. Otherwise this is round N = priorRounds + 1.</rule>
</rules>

<step id="1" name="Read the change-request threads + check the loop cap">
Parse `<n>`. `pr=$(gh pr list --repo j0ntz/tcg-art --head "jon/task-<n>" --state open --json number -q '.[0].number')`. The review is now a FORMAL review object with one inline thread per change request (review-task no longer posts a loose comment). Read them:
- latest review: `gh api repos/j0ntz/tcg-art/pulls/<pr>/reviews` -> the most recent whose `body` has the `<!-- review-task -->` marker (its first line is the verdict).
- the change requests: `gh api repos/j0ntz/tcg-art/pulls/<pr>/comments` -> the inline review comments, one per change request, each with `path`, `line`, `id`, `body`.
Apply `loop-cap`: count `<!-- address-round -->` markers; if >= 2, validate -> Blocked and stop.
</step>

<step id="2" name="Address each change request">
For every change-request thread: make the minimal correct fix in this worktree following CLAUDE.md, and `git commit`. If a request is genuinely wrong or not applicable, do not change code for it but note why (you will say so in the thread reply). Run `npm run build` (sfw if needed) as a sanity gate before pushing.
</step>

<step id="3" name="Push">
`git push` the fixup commits to `jon/task-<n>` (re-triggers the Vercel preview build that Testing will verify).
</step>

<step id="4" name="Reply, RESOLVE each thread, mark the round">
For each change-request thread:
- reply with the fix (commit) or why it was declined: `gh api -X POST repos/j0ntz/tcg-art/pulls/<pr>/comments/<comment_id>/replies -f body='<addressed: commit / declined: why>'`.
- resolve the thread via GraphQL: list the PR's review threads (`gh api graphql -f query='{repository(owner:"j0ntz",name:"tcg-art"){pullRequest(number:<pr>){reviewThreads(first:50){nodes{id isResolved comments(first:1){nodes{databaseId}}}}}}'`), match each unresolved thread to its comment id, then `gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -f t=<threadId>`.
Then post ONE round-marker issue comment via `gh issue comment <n> --repo j0ntz/tcg-art --body-file <file>` (editor, not heredoc) starting with `<!-- address-round -->` that summarizes the round (per change request: addressed/declined). The marker increments the loop counter.
</step>

<step id="5" name="Re-enter at Coded">
`bash orchestration/board.sh status <n> Coded`. The Testing handler re-verifies the new HEAD; because `in-review` is set, Testing auto-advances to Review for another pass. Print a one-line summary (issue, PR, round, change requests addressed), then stop.
</step>
