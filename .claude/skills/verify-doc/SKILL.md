---
name: verify-doc
description: Independently verify ONE Verifying doc or ops task — a completeness + soundness check (no preview to test) — and route it binary: change requests -> Running, clean -> Verified (opened a PR) or Done (research-only / board-ops with no PR). Fresh agent, not the author. CHECKS, does not fix. Invoked as `/verify-doc <issue-url>` by the Verify handler. Repo-local.
---

<goal>Verify ONE doc or ops task (the GitHub issue passed as `/verify-doc <issue-url>`) COLD. For a doc: does it deliver what the issue asked, are claims/links sound, is it internally consistent and standards-clean. For an ops task: was the operational goal actually met. Binary verdict: change requests -> Running; clean + open PR -> Verified; clean + no PR -> Done. You did NOT write it; you CHECK, you do NOT fix.</goal>

<rules>
<rule id="hands-off">ONE turn, unattended. Before flagging blocked run `/validate-block <issue-url> "<reason>"` and obey it (true -> add the `blocked` label, do NOT change the state, post the blocker, stop).</rule>
<rule id="check-not-fix">Verify and report; do NOT edit (fixes happen in Running). File change requests and route to Running.</rule>
<rule id="binary-verdict">A finding is either a CHANGE REQUEST or you do not raise it.</rule>
</rules>

<step id="1" name="Read + classify">
Parse `<n>`. `gh issue view <n> --repo j0ntz/tcg-art --json title,body,labels`. Resolve any PR: `pr=$(gh pr list --repo j0ntz/tcg-art --head jon/task-<n> --state open --json number -q '.[0].number')`. A PR present = doc/repo-bound; no PR = research-only or board-ops.
</step>

<step id="2" name="Check">
- **Doc task (PR present)**: read `gh pr diff <pr>` and the doc(s). Verify EACH deliverable named in the issue is actually delivered; spot-check that cited facts/links resolve and the proposed design is sound and self-consistent; if the change touches code, `npm run build` (sfw) must pass. Anything missing / wrong / unsound is a change request (file:line).
- **Ops task (no PR)**: verify the operational goal stated in the issue is met — e.g. the target tasks reached their expected states and their PRs merged (`gh pr list`, the board). If the goal is not met, that is a change request.
</step>

<step id="3" name="Post + route (binary)">
- **Any change requests**: post them — for a PR, ONE formal review (`gh api -X POST repos/j0ntz/tcg-art/pulls/<pr>/reviews --input <payload.json>`, `event=COMMENT`, body `<!-- review-task -->`, one inline thread per request); for an ops task with no PR, ONE issue comment listing them with the `<!-- review-task -->` marker (write with the editor, not a heredoc). Then `bash orchestration/board.sh status <n> Running`.
- **Clean + open PR**: `bash orchestration/board.sh status <n> Verified`.
- **Clean + no PR** (research-only / ops): post a one-line "verified: <what was confirmed>" issue comment, then `bash orchestration/board.sh status <n> Done`.
Print a one-line summary, then stop.
</step>
