---
name: verify-code
description: Independently verify ONE Verifying code task — preview-test on its Vercel deployment THEN a cold PR review — and route it binary: change requests -> Pending (the watch handler re-spawns the work agent, which addresses the threads), clean -> Verified. Fresh agent, not the builder. CHECKS, does not fix. Invoked as `/verify-code <issue-url>` by the Verify handler. Repo-local; do NOT load the Edge `/pr-review`.
---

<goal>Verify ONE code task's PR (the GitHub issue passed as `/verify-code <issue-url>`) COLD: confirm it works on the real Vercel preview, then review the diff as an adversarial outside reviewer. Binary verdict: any change requests (broken preview OR review findings) -> back to Pending for re-work pickup; clean -> Verified. You did NOT write this code. You CHECK, you do NOT fix — fixes happen in the re-spawned work agent.</goal>

<rules>
<rule id="hands-off">ONE turn, unattended. Before flagging blocked run `/validate-block <issue-url> "<reason>"` and obey it (true -> add the `blocked` label, do NOT change the state, post the blocker, stop).</rule>
<rule id="check-not-fix">You verify and report; you do NOT edit code (that is work-task's job). File each problem as a change request and route the task to Pending. NEVER route to Running: no handler spawns for Running, so the task strands until the watchdog wrongly flags it blocked (this exact failure happened on issue #13).</rule>
<rule id="binary-verdict">A finding is either a CHANGE REQUEST (worth a code change before land) or you do not raise it — no "nit" tier.</rule>
<rule id="self-review-limit">Same-account PR, so GitHub forbids a formal APPROVE/REQUEST_CHANGES (422); submit the review with `event=COMMENT`. Routing is driven by whether you filed change-request threads, not a GitHub review state.</rule>
<rule id="feedback-comments">Human `feedback:` issue comments newer than the last `<!-- address-round -->` marker are acceptance criteria. If the work did not act on one (no +1 reaction, no round summary entry, not reflected in the deliverable), that is a change request.</rule>
</rules>

<step id="1" name="Read + resolve the PR">
Parse `<n>`. `pr=$(gh pr list --repo j0ntz/tcg-art --head jon/task-<n> --state open --json number -q '.[0].number')`. If empty -> `/validate-block` -> add `blocked`. Read `gh issue view <n>` (the requirement) and `gh pr diff <pr>`. Load the repo CLAUDE.md standards.
</step>

<step id="2" name="Preview-test">
`bash orchestration/verify-preview.sh <pr> "<expected-substring>"` (a string that proves the change rendered; includes the mobile capture). If `RESULT=fail` because the CODE is wrong, that is a change request (record it). If it's a transient deploy hiccup, retry once or twice. Note the `SCREENSHOT=` path(s).
</step>

<step id="3" name="Cold review">
Review the diff for correctness/logic, security, web TS standards (no `any`, `??` over `||`, effect cleanup), and spec adherence (does it do what issue #<n> asked?). Per `binary-verdict`, each finding worth a code change is a CHANGE REQUEST anchored to file:line; do not invent findings.
</step>

<step id="4" name="Post + route (binary)">
- **Any change requests** (preview-fail or review findings): post ONE formal review via the reviews API — `gh api -X POST repos/j0ntz/tcg-art/pulls/<pr>/reviews --input <payload.json>` with `{ "event":"COMMENT", "body":"<!-- review-task --> CHANGES REQUESTED (<k>)", "comments":[{"path":...,"line":...,"side":"RIGHT","body":"<what+why+fix>"}, ...] }` (build the payload with the editor, not a heredoc, per the `sfw` npm-heredoc gotcha). Then `bash orchestration/board.sh status <n> Pending` (the watch handler re-spawns work-task, which sees the open threads and enters address mode).
- **Clean**: write the run report — fill `orchestration/templates/run-report.md` into `docs/run-reports/issue-<n>-<slug>.md`, commit screenshots under `docs/screenshots/`, push, and post it on the issue (lead with the live preview URL). Then `bash orchestration/board.sh status <n> Verified`.
Print a one-line summary (issue, PR, verdict, next state), then stop.
</step>
