---
name: review-task
description: Independently review ONE Review-state board task's PR on this subscription, post it as a FORMAL review (a real review object with one inline resolvable thread per change request, not a loose comment), then route binary - no change requests -> Reviewed, any change requests -> Address. Fresh agent with no memory of building the change. Invoked as `/review-task <issue-url>` by the Review handler. Repo-local; do NOT load the Edge `/pr-review`.
---

<goal>Review ONE task's PR (the GitHub issue passed as `/review-task <issue-url>`) cold and skeptically, post a FORMAL review to the PR (a real review object with one inline resolvable thread per change request, not a loose issue comment), then route the board BINARY: no change requests -> Reviewed; one or more change requests -> Address. You are a FRESH agent: you did NOT write this code. Review it as an adversarial outside reviewer, not the author.</goal>

<rules>
<rule id="local-review">This is a LOCAL review on the Claude Max subscription, NOT the cloud `/code-review ultra` (that is separately billed and cannot be auto-triggered). You read the diff and judge it yourself, then POST a formal review to the PR with `gh` so it is durable and `address-task` can act on it thread by thread. Works on private repos (all local + gh-authed).</rule>
<rule id="binary-verdict">Review is BINARY: a finding is either a CHANGE REQUEST (worth a code change before land) or you do not raise it. There is NO "nit"/optional tier. If something is worth changing, file it as a change request; if it is not worth changing, leave it out entirely. Zero change requests means APPROVE.</rule>
<rule id="self-review-limit">The PR is authored by the same account running the review, so GitHub forbids a formal APPROVE or REQUEST_CHANGES event on it (HTTP 422). Submit the review with `event=COMMENT` and put the verdict in the body's first line. The binary routing is driven by whether you filed any change-request threads, NOT by a GitHub review state.</rule>
<rule id="hands-off">Run in ONE turn, unattended. Before any Blocked you MUST run `/validate-block <issue-url> "<reason>"` and obey it. Reserve Blocked for a PR that is fundamentally unworkable (rare); normal change requests route to Address, not Blocked.</rule>
<rule id="scope">Review only; do NOT edit code, merge, or push fixes (that is `address-task`'s job). Posting the review + inline threads via `gh` is allowed and expected.</rule>
<rule id="standards">Judge against this repo's CLAUDE.md "Web TypeScript standards" + correctness, security, and whether the change actually satisfies the issue/spec. Be specific on each change request: file:line + what + why + the fix.</rule>
</rules>

<step id="1" name="Read the task + resolve the PR">
Parse `<n>`. `pr=$(gh pr list --repo j0ntz/tcg-art --head "jon/task-<n>" --state open --json number -q '.[0].number')`. Read `gh issue view <n>` (the requirement) and the change: `gh pr diff <pr>` plus the files it touches in your worktree. Load the repo CLAUDE.md standards.
</step>

<step id="2" name="Review">
Assess the diff for: correctness/logic bugs, security, web TS standards violations (no `any`, `??` over `||`, cleanup in effects, etc.), and spec adherence (does it do what issue #<n> asked?). Per `binary-verdict`, every finding worth a code change is a CHANGE REQUEST anchored to a `file:line`; do not file anything you would not block on, and do not invent change requests. If nothing is worth changing, the verdict is APPROVE.
</step>

<step id="3" name="Post a FORMAL review with one inline thread per change request">
Post ONE formal review object via the reviews API (NOT a loose `gh pr comment`), so each change request becomes a resolvable inline thread `address-task` can reply to and close. Build the payload with the editor (a JSON file, not a heredoc, per the `sfw` npm-heredoc gotcha), then:

  gh api -X POST repos/j0ntz/tcg-art/pulls/<pr>/reviews --input <payload.json>

Payload shape:

  { "event": "COMMENT",
    "body": "<verdict line>",
    "comments": [ {"path": "app/...", "line": <diff line>, "side": "RIGHT", "body": "<what + why + fix>"}, ... ] }

The `body` first line is the verdict and carries the marker so `address-task` finds the latest review: `<!-- review-task --> CHANGES REQUESTED (<k> items)` or `<!-- review-task --> APPROVE (no change requests)`. Each `comments[]` entry is ONE change request anchored to the exact `path` + `line` in the diff. If clean, submit with an empty `comments` array and the APPROVE body.
</step>

<step id="4" name="Route the board (binary)">
- If you filed ANY change requests: `bash orchestration/board.sh add-label <n> in-review` (so the re-test loop auto-advances Testing->Review), then `bash orchestration/board.sh status <n> Address`.
- If zero (APPROVE): `bash orchestration/board.sh remove-label <n> in-review`, then `bash orchestration/board.sh status <n> Reviewed`.
Print a one-line summary (issue, PR, verdict, change-request count, next state), then stop.
</step>
