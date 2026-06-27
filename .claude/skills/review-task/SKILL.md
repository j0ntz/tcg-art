---
name: review-task
description: Independently review ONE Review-state board task's PR on this subscription (local review, posted to the PR via gh), then route it: clean -> Reviewed, actionable issues -> Address. Fresh agent with no memory of building the change. Invoked as `/review-task <issue-url>` by the Review handler. Repo-local; do NOT load the Edge `/pr-review`.
---

<goal>Review ONE task's PR (the GitHub issue passed as `/review-task <issue-url>`) cold and skeptically, post a structured review to the PR, then route the board: no actionable issues -> Reviewed; actionable issues -> Address. You are a FRESH agent: you did NOT write this code. Review it as an adversarial outside reviewer, not the author.</goal>

<rules>
<rule id="local-review">This is a LOCAL review on the Claude Max subscription, NOT the cloud `/code-review ultra` (that is separately billed and cannot be auto-triggered). You read the diff and judge it yourself, then POST your findings to the PR with `gh` so they are durable and `address-task` can act on them. Works on private repos (all local + gh-authed).</rule>
<rule id="hands-off">Run in ONE turn, unattended. Before any Blocked you MUST run `/validate-block <issue-url> "<reason>"` and obey it. Reserve Blocked for a PR that is fundamentally unworkable (rare); normal findings route to Address, not Blocked.</rule>
<rule id="scope">Review only; do NOT edit code, merge, or push fixes (that is `address-task`'s job). Posting PR comments via `gh` is allowed and expected.</rule>
<rule id="standards">Judge against this repo's CLAUDE.md "Web TypeScript standards" + correctness, security, and whether the change actually satisfies the issue/spec. Separate BLOCKING/actionable findings from nits. Be specific: file:line + what + why + the fix.</rule>
</rules>

<step id="1" name="Read the task + resolve the PR">
Parse `<n>`. `pr=$(gh pr list --repo j0ntz/tcg-art --head "jon/task-<n>" --state open --json number -q '.[0].number')`. Read `gh issue view <n>` (the requirement) and the change: `gh pr diff <pr>` plus the files it touches in your worktree. Load the repo CLAUDE.md standards.
</step>

<step id="2" name="Review">
Assess the diff for: correctness/logic bugs, security, web TS standards violations (no `any`, `??` over `||`, cleanup in effects, etc.), and spec adherence (does it do what issue #<n> asked?). Classify each finding as BLOCKING (must fix before land) or nit (optional). If you find nothing actionable, say so honestly; do not invent issues.
</step>

<step id="3" name="Post the review to the PR">
Post one structured review comment via `gh pr comment <pr> --repo j0ntz/tcg-art --body-file <file>` (write the body with the editor, not a heredoc, per the `sfw` npm-heredoc gotcha). Structure: a one-line verdict (APPROVE / CHANGES REQUESTED), then BLOCKING findings (file:line, problem, fix), then nits. Start the body with the marker `<!-- review-task -->` so `address-task` can find the latest review.
</step>

<step id="4" name="Route the board">
- If there are BLOCKING findings: `bash orchestration/board.sh add-label <n> in-review` (so the re-test loop auto-advances Testing->Review), then `bash orchestration/board.sh status <n> Address`.
- If clean (no blocking findings): `bash orchestration/board.sh remove-label <n> in-review`, then `bash orchestration/board.sh status <n> Reviewed`.
Print a one-line summary (issue, PR, verdict, next state), then stop.
</step>
