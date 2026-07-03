---
name: draft-task
description: Front door for the orchestration — turn a task intent (free text or an idea) into a well-structured GitHub issue, classify its flavor, queue it on project #1 as Pending, and apply the right labels so the orch picks it up. Use to create a new orch task. Invoked as `/draft-task <intent...>`. Repo-local.
---

<goal>Turn a task intent into a queued orch task: a structured GitHub issue (Goal / Deliverables / Constraints / Acceptance), the right flavor + automation labels, added to project #1 and set Pending. Present the draft for confirmation before queueing unless told to queue directly.</goal>

<rules>
<rule id="flavor">Classify the work and set the flavor label(s). None = **code** (produces a code PR). `research` / `design` / `instructions` = a **doc** that lands in the repo (research findings / a design or TDD proposal / a runbook). `chore` = **ops/maintenance** (board ops, deps, config). Flavors are multi-select (e.g. `research` + `design`) and do NOT decide the path — **PR-presence** does: a doc/chore that commits a file lands (Verified -> Landing -> Done); research-only findings or board-ops with no PR go straight to Done.</rule>
<rule id="auto-land">Add `auto-land` only for low-risk, trust-to-merge tasks (most docs, most chores) so they skip the human Verified -> Landing gate and run fully hands-off. Leave it off for code you want to eyeball before it merges.</rule>
<rule id="model">The task's agents start on the model/effort in its **Agent Model** / **Agent Effort** board single-selects (unset = the orch defaults). Set them only when the caller asked or the task obviously warrants it (e.g. a heavy design task on the top model at xhigh, a mechanical chore on a cheaper one at low): `bash orchestration/board.sh model <n> "<label>"` (labels: Fable 5 / Opus 4.8 / Opus 4.7 / Sonnet 5 / Sonnet 4.6; quote them) and `bash orchestration/board.sh effort <n> <low|medium|high|xhigh|max>`. When in doubt leave them unset.</rule>
<rule id="structure">The issue body MUST have **Goal**, **Deliverables** (concrete and checkable), **Constraints** (cite `CLAUDE.md` standards), and **Acceptance**. For a doc task, the deliverables name the doc path(s) under `docs/` and what each must contain. Write the body with the editor (a body file), NOT a heredoc (the `sfw` npm-heredoc gotcha).</rule>
</rules>

<step id="1" name="Scope">Read the intent. If it is underspecified in a way that would change the deliverable, ask 1-3 sharp questions first (only when truly undeterminable; otherwise pick a defensible default). Decide the flavor(s) and whether `auto-land` fits.</step>

<step id="2" name="Draft">Write the issue body (Goal / Deliverables / Constraints / Acceptance) to a file with the editor. Present it for confirmation unless the caller said to queue directly.</step>

<step id="3" name="Queue">On confirmation:
- `url=$(gh issue create --repo j0ntz/tcg-art --title "<concise>" --body-file <file> [--label <flavor> ...])` (the flavor labels must exist: research / design / instructions / chore).
- `gh project item-add 1 --owner j0ntz --url "$url"`.
- `bash orchestration/board.sh status <n> Pending`.
- if warranted: `bash orchestration/board.sh add-label <n> auto-land`.
- if a model/effort was chosen: `bash orchestration/board.sh model <n> "<label>"`, `bash orchestration/board.sh effort <n> <level>`.
Print the issue URL, the labels applied, and the model/effort (if set). The orch's watch handler picks it up on the next tick.</step>
