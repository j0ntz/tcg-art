# Orch subtasks: parent/child tasks via GitHub sub-issues

Design for issue #16. How multi-deliverable work fans out into child tasks that each ride the normal
6-state pipeline, with the parent tracking completion, using GitHub's native sub-issues as the link
mechanism. Mirrors the spirit of the Edge orch's Asana subtask rules.

## 1. Why (the #13 lesson)

Issue #13 (landing rework, 2-3 option branches under one issue) was the first task that strained the
one-issue-one-branch assumption. Its workaround: one primary PR on `jon/task-13` plus draft alternate
PRs on `jon/task-13-opt-*`, compared in an issue comment. It produced the deliverables, but every
option lived or died with ONE work session and ONE board item: the pipeline could verify and land
only the primary branch, the alternates were invisible to the board, and when the single work agent's
session ended early the watchdog flagged the whole task blocked. With sub-issues, each option would
have been its own child task with its own state, session, verify, and land.

## 2. The native mechanism (verified 2026-07-02, gh 2.93.0, live against j0ntz/tcg-art)

GitHub sub-issues are the right native mechanism (issue task-lists are a legacy rendering feature
with no relationship API; "issue dependencies" model blocked-by ordering, not hierarchy). Everything
below is REST, so it spends ZERO GraphQL budget (REST core is a separate 5000/hr pool).

| Operation | Call |
|---|---|
| List children (with `state`) | `GET /repos/{o}/{r}/issues/{parent#}/sub_issues` |
| Add child | `POST /repos/{o}/{r}/issues/{parent#}/sub_issues` with `sub_issue_id` |
| Remove child | `DELETE /repos/{o}/{r}/issues/{parent#}/sub_issue` with `sub_issue_id` |
| Get a child's parent | `GET /repos/{o}/{r}/issues/{child#}/parent` (404 when no parent) |
| Rollup on the parent payload | `.sub_issues_summary` = `{total, completed, percent_completed}` |

Verified gotchas:

- **`sub_issue_id` is the issue's int64 `id`, NOT its number.** Resolve first:
  `gh api repos/{o}/{r}/issues/{child#} --jq .id`.
- **`sub_issues_summary` is eventually consistent** (observed `total: 1` immediately after linking
  two children; it caught up seconds later). Anything that gates MUST read the `/sub_issues` list,
  never the summary. The summary is display-only.
- A child's payload gains `parent_issue_url` once linked (absent otherwise); the `/parent` endpoint
  is the reliable probe from the child side.
- `gh` 2.93.0 has no native sub-issue commands or JSON fields; `gh api` is the interface.
- `completed` in the summary counts CLOSED children. A no-PR child (research/ops) goes board-Done
  with its issue still open, so issue state alone is not the completion signal either (see §4).
- Platform limits: 100 sub-issues per parent, 8 nesting levels.

## 3. Decisions

### D1. Children are full board tasks (the Edge pattern)

Each child is a normal issue: its own board item, its own Agent Status, its own flavor labels, its
own `jon/task-<child#>` branch and PR, its own model/effort fields. The watch/verify/land handlers
and the watchdog treat a child EXACTLY like any other task; no handler has child-specific code.
The only child-side difference: `/work-task` reads the parent issue for context.

### D2. The parent waits in Pending behind a completion gate

The parent is also a normal board item, but `watch.sh` will not spawn work for it until every child
is complete. It sits in **Pending** while children flow. When the last child completes, the gate
opens and the parent is picked up like any Pending task: its work agent does the fan-in (integration
work or a completion summary, per its issue), then routes to its own Verifying, and the PR-presence
fork applies as usual (PR -> Verified -> Landing -> Done; no PR -> Done).

Why Pending and not Running (the Edge phrasing "parent sits in Running until children are Done"):

- **Running's contract is "a live `claude-work-<n>` session exists".** The watchdog flags any
  Running item with a dead session as `blocked` within one sweep, and would do so for a session-less
  waiting parent. Exempting parents would special-case the watchdog for zero benefit.
- **A 7th "Waiting" state is operationally hazardous**, not just heavier: editing the Agent Status
  single-select options via the API recreates ALL option IDs and clears every item's status (the
  documented v1->v2 migration gotcha). The gate avoids touching the field.
- Pending is semantically true: the parent IS queued work that is not being worked yet.

The gate is visible three ways: the `parent` label on the issue, GitHub's native sub-issue progress
bar, and the tick log line `[watch] #<n> parent waiting (k/t children done)`.

### D3. Child completeness = issue CLOSED, or board status Done

Covers both exits: a repo-bound child's issue closes when its PR merges (`Closes #<n>`), and a
research/ops child goes board-Done with the issue left open. A child removed from the board counts
only via its issue state. The check reads child issue states from the one `/sub_issues` REST call
and board statuses from the tick's existing board snapshot (zero extra GraphQL).

### D4. Parenthood is detected from the native link, not a label

The authoritative probe is `/sub_issues` returning a non-empty list. The `parent` label that
`/draft-task` applies is cosmetic (board/issue-list visibility for humans) and nothing gates on it,
so it cannot drift out of sync with reality. Someone hand-linking sub-issues in the GitHub UI gets
correct orch behavior without knowing the label convention.

### D5. Branch naming: children are normal, the parent may not need a branch

Children: `jon/task-<child#>`, exactly as any task. Parent: if its fan-in produces repo changes it
uses `jon/task-<parent#>` as normal; a pure-coordination parent (summary comment only) never opens
a PR and goes straight to Done after verify, like any ops task.

### D6. `/draft-task` splits when deliverables are independently verifiable

New rule: if an intent contains two or more deliverables that could each ride their own PR and be
verified independently (the #13 shape: "N distinct options", "do X for each of A/B/C"), draft a
parent plus one child per deliverable. The parent's issue holds the umbrella goal, the fan-in
deliverable (comparison/integration/summary), and the acceptance for the whole. Each child's issue
is self-contained (a work agent sees only its own issue plus the parent for context). Queue children
Pending first, then the parent (order does not matter to the gate). For a fully hands-off fan-out,
put `auto-land` on the children; a child parked at the Verified human gate holds the parent's gate
closed (by design: the human is still deciding).

### D7. Recursion works but is not the recommended shape

The gate is uniform: a child that is itself a parent waits in Pending for ITS children first, so
multi-level trees behave correctly with no extra code. Keep hierarchies to one level anyway;
this orch's tasks are small, and deep trees hide progress.

## 4. The derivation rule (parent state as a function of children)

```
children all complete?           parent behavior
------------------------------   ------------------------------------------
no  (any open + not board-Done)  held in Pending by the watch gate; skipped
                                 each tick with a "waiting k/t" log line
yes (each closed or board-Done)  next tick: watch spawns /work-task on the
                                 parent; from here it is a NORMAL task:
                                 Running -> Verifying -> [Verified ->
                                 Landing ->] Done by PR-presence
```

A blocked child does not block the parent explicitly; the parent just keeps waiting, and the child
carries the visible `blocked` label. If a parent is spawned prematurely (e.g. hand-set to Running),
its work agent re-checks the gate, routes it back to Pending, and stops.

## 5. Budget

- Watch gating: one REST call (`/sub_issues`) per Pending candidate per tick, stopping at the first
  eligible item. Pending queues here are single digits; worst case ~10 REST/tick = 600/hr against
  the 5000/hr REST pool, and the common case (no parents queued) adds one call for the single item
  watch.sh was already going to spawn.
- Board statuses for the gate come from `ORCH_BOARD_SNAPSHOT` (already fetched once per tick).
- No new GraphQL anywhere: skills use `gh api` REST for link reads/writes.

## 6. Implementation map

| Piece | Change |
|---|---|
| `orchestration/lib.sh` | `sub_issues_json`, `parent_of`, `children_gate` helpers; `ORCH_DRY_RUN` in `spawn_agent` (print instead of spawn, for testing) |
| `orchestration/watch.sh` | iterate Pending candidates (was: first only); skip `blocked`; hold parents behind `children_gate`; spawn the first eligible |
| `orchestration/board.sh` | `children <n>`, `parent <n>`, `add-child <parent#> <child#>` subcommands |
| `.claude/skills/draft-task` | split rule (D6) + queue steps for parent/children linking |
| `.claude/skills/work-task` | role detection in step 1; parent fan-in step; premature-spawn re-queue; child reads parent for context |
| `.claude/skills/verify-doc` | parent tasks: verify all children complete + the fan-in deliverable |
| `verify.sh`, `land.sh`, `watchdog.sh`, `tick.sh` | no changes needed: a gated parent never reaches them until it behaves like a normal task (verified in the toy run) |

## 7. Alternatives considered

- **Parent waits in Running:** conflicts with the watchdog's dead-session detection (see D2).
- **A new "Waiting" board state:** option-ID recreation hazard + heavier state machine (see D2).
- **Task-list checkboxes in the parent body:** no API-visible relationship objects, no per-child
  state; exactly the #13 workaround with more markdown.
- **Issue dependencies (`issue_dependencies_summary`):** models "blocked by" ordering between
  peers, not parent/child hierarchy; no rollup of children under an umbrella.
- **Gating on `sub_issues_summary`:** one call instead of the list, but it is eventually consistent
  and counts only CLOSED children, missing board-Done research/ops children (see §2, D3).
