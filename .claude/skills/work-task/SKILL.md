---
name: work-task
description: Take ONE board task (a GitHub issue) from Pending to its deliverable, hands-off, then route it to Verifying. Branches on flavor — code (build + PR), doc (research/design/instructions: write docs + PR), or ops/chore (operate on the board, usually no PR). On re-entry it instead ADDRESSES the open review threads and any unconsumed human issue comments. Invoked as `/work-task <issue-url>` by the Pending handler. Repo-local; do NOT load the Edge `/im` or `/pr-address`.
---

<goal>Take ONE task (the GitHub issue passed as `/work-task <issue-url>`) from Pending/Running to its deliverable, fully hands-off, then set it Verifying for the independent check. Two modes: INITIAL work, or — if the PR carries unresolved review threads OR the issue carries unconsumed human comments (re-entry) — ADDRESS them. Never merge; the lander does that.</goal>

<rules>
<rule id="hands-off">Run in ONE turn, unattended (no AskUserQuestion). Before flagging blocked you MUST run `/validate-block <issue-url> "<reason>"` and obey it: `legitimate:false` -> do its `what_to_try` and continue; only `legitimate:true` -> add the `blocked` label (do NOT change the state), post ONE line naming the blocker, stop.</rule>
<rule id="scope">Work ONLY in the current worktree (your cwd). Commit to THIS branch. Never merge/tag/publish/deploy. An ops task may drive OTHER tasks' board state and branches, but only as the issue directs.</rule>
<rule id="conventions">Follow this repo's CLAUDE.md (web TS standards, repo-local skills, plain `git commit`). Use npm; prefix `sfw` if your shell blocks bare npm/npx.</rule>
<rule id="address-loop-cap">In ADDRESS mode, count prior rounds by issue comments carrying the marker `<!-- address-round -->` that are NEWER than the newest human comment (fresh human feedback resets the cap; the cap exists to stop verifier ping-pong, not to limit the human). If 2 such rounds already happened, do NOT address again: `/validate-block`, then add the `blocked` label.</rule>
<rule id="orch-comment-marker">EVERY issue comment you post MUST start with an HTML marker: `<!-- orch -->` (or a more specific one like `<!-- address-round -->`). Unmarked comments are reserved for the human; an unmarked agent comment would be misread as human feedback by the next agent.</rule>
<rule id="feedback-comments">ANY issue comment whose body does NOT start with `<!--` is human feedback, no prefix needed. UNCONSUMED = it has no +1 reaction yet (the reaction is the orch's receipt; check the `reactions` field when listing comments). Treat each unconsumed one as a requirement equal to a review thread; when directives conflict, the NEWEST comment wins. A comment with no actionable ask (e.g. praise): consume it with a +1 and move on. After acting on one: `gh api -X POST repos/j0ntz/tcg-art/issues/comments/<id>/reactions -f content='+1'` and list it in your round summary.</rule>
</rules>

<step id="1" name="Read the task + pick the mode + detect the sub-issue role">
Parse `<n>`. `gh issue view <n> --repo j0ntz/tcg-art --json title,body,labels,comments` (comments matter: unmarked ones are human directives; on INITIAL they refine the spec). The FLAVOR is in the labels: `research` / `design` / `instructions` / `chore` (any present = doc/ops kind; none = code). Resolve any PR: `pr=$(gh pr list --repo j0ntz/tcg-art --head jon/task-<n> --state open --json number -q '.[0].number')`.
- If (`pr` exists AND it has UNRESOLVED review threads (`gh api repos/j0ntz/tcg-art/pulls/<pr>/comments`)) OR the issue has UNCONSUMED human comments (unmarked + un-reacted) -> **ADDRESS** mode.
- Else -> **INITIAL** mode (unconsumed human comments, if any exist pre-PR, are part of the spec: consume + react to them as in ADDRESS).
Detect the sub-issue role (`docs/orch-subtasks-design.md`): `bash orchestration/board.sh gate <n>` -> `none` = a normal task; `ready`/`waiting` = a **PARENT** (INITIAL work follows step 2-parent instead of 2-initial). `bash orchestration/board.sh parent <n>` prints a parent number = this is a **CHILD**: work it as a normal task, but read the parent issue first for umbrella context.
`bash orchestration/board.sh status <n> Running` (idempotent).
</step>

<step id="2-initial" name="INITIAL: do the work by flavor">
- **code** (no flavor): implement to the issue's definition of done following CLAUDE.md; `git commit`; `npm run build` (sfw if needed) MUST pass; push; open a PR (`gh pr create --repo j0ntz/tcg-art --base main --head jon/task-<n> --title "<concise>" --body "Closes #<n> ..."`).
- **doc** (`research`/`design`/`instructions`): research (web + codebase) and write the deliverable doc(s) under `docs/` per the issue's deliverables; `git commit`; push; open a PR.
- **ops/`chore` that operates on the board** (no artifact of its own): do the operational work directly per the issue (e.g. fix other tasks' branches and drive them through their states). Do NOT open a PR for THIS task. A research-only investigation: post the findings as an issue comment (starting with `<!-- orch -->`); no PR.
</step>

<step id="2-parent" name="INITIAL, parent task: fan-in">
Applies when step 1 detected a PARENT (replaces 2-initial). First re-check the gate: `bash orchestration/board.sh gate <n>`. If it prints `waiting:<k>/<t>`, this spawn was premature (the watch gate holds parents until every child is complete): `bash orchestration/board.sh status <n> Pending`, print one line saying so, stop; do NOT work it. On `ready`, do the parent's OWN fan-in deliverable per its issue body:
- Fan-in that changes the repo (an integration, a comparison doc): treat it as the matching flavor in 2-initial (commit, build gate for code, push, PR).
- Pure coordination (nothing to commit): post ONE issue comment summarizing each child (`bash orchestration/board.sh children <n>` for the list): number, title, outcome, PR/merge link. No PR.
Then route to Verifying (step 3) as normal.
</step>

<step id="2-address" name="ADDRESS: resolve the review threads + feedback">
For each unresolved review thread (a change request) AND each unconsumed human issue comment: make the minimal correct fix following CLAUDE.md, `git commit`. A human directive may be bigger than a review nit (e.g. "promote option B to primary", "redo X"); do the work it actually asks. If code changed, `npm run build` (sfw) as a sanity gate. `git push`. Then reply to AND resolve each thread: `gh api -X POST repos/j0ntz/tcg-art/pulls/<pr>/comments/<comment_id>/replies -f body='<addressed/declined>'`, then resolve via `gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -f t=<threadId>` (get thread ids from the PR's `reviewThreads`). React +1 to each consumed human comment. Post ONE `<!-- address-round -->` issue comment summarizing the round: threads resolved + human comments consumed, by link (increments the loop counter).
</step>

<step id="3" name="Route to Verifying">
`bash orchestration/board.sh status <n> Verifying`. Print a one-line summary (issue, mode, flavor, PR if any), then stop. The verify handler picks it up.
</step>
