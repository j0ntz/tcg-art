# Agent run report: Orch subtask support via GitHub sub-issues

**PR: (filled on the issue; branch `jon/task-16`)**

| field | value |
|---|---|
| Task | #16 · https://github.com/j0ntz/tcg-art/issues/16 |
| Branch | `jon/task-16` |
| Design | `docs/orch-subtasks-design.md` |
| Date | 2026-07-02 |

## Summary

Parent/child task support built on GitHub's native sub-issues (REST, zero GraphQL): children are
normal board tasks; the parent waits in Pending behind a `children_gate` in `watch.sh` until every
child is complete (issue closed or board Done), then rides the normal pipeline for its own fan-in
deliverable. Demonstrated live with toy parent #23 + children #24/#25 driven through the board.

## What changed

- `orchestration/lib.sh`: `sub_issues_json` / `parent_of` / `children_gate` helpers (REST only,
  board statuses from the tick snapshot); `ORCH_DRY_RUN` in `spawn_agent` for spawn-free testing.
- `orchestration/watch.sh`: scans Pending candidates in board order (was: first item only), skips
  `blocked` and gated parents, spawns the first eligible.
- `orchestration/board.sh`: `children` / `parent` / `gate` / `add-child` subcommands.
- Skills: `draft-task` (split rule + parent/child queueing), `work-task` (role detection, parent
  fan-in step, premature-spawn re-queue), `verify-doc` (parent completeness check).
- `verify.sh` / `land.sh` / `watchdog.sh` / `tick.sh`: no changes needed (a gated parent never
  reaches them until it behaves as a normal task).
- New label `parent` (visibility only; the gate keys off the native sub-issue links).

## Test evidence (toy run, real board + real sub-issue links, 2026-07-02)

Toys: parent #23 (labels `chore`+`parent`), children #24, #25, linked via
`board.sh add-child`, all queued Pending with the parent FIRST in board order. The launchd cron was
paused for the test window (so no real agents raced the demo) and re-armed after; agent spawns were
exercised with `ORCH_DRY_RUN=1` (everything up to the tmux spawn is real: worktree provisioning,
status transitions, gate decisions).

1. Tick 1: `[watch] #23 parent waiting (0/2 children complete)` -> child #24 provisioned
   (`jon/task-24` worktree), `#24 -> Running`, would spawn `claude-work-24`. The parent was
   correctly skipped in favor of the next eligible candidate.
2. Child #24 driven Running -> Verifying -> Verified -> Landing -> Done, issue CLOSED (the
   repo-bound exit: a merged PR closes the issue). Gate: `waiting:1/2`.
3. Tick 2: `[watch] #23 parent waiting (1/2 children complete)` -> child #25 picked, `-> Running`.
4. Child #25 driven Running -> Verifying -> Done with its issue left OPEN (the research/ops exit:
   board-Done, no PR). Fresh gate read: `ready`, children table `24 closed Done / 25 open Done`,
   proving BOTH completion arms (issue-closed and board-Done).
5. Tick 3: `[watch] #23 parent gate open (all children complete)` -> parent picked, `-> Running`,
   would spawn `claude-work-23`.
6. Parent fan-in: summary comment posted on #23
   (https://github.com/j0ntz/tcg-art/issues/23#issuecomment-4872756164), routed Verifying.
   `ORCH_DRY_RUN=1 verify.sh` treated the parent as a normal Verifying task and picked
   `/verify-doc` via its `chore` flavor. Simulated clean/no-PR verdict -> Done, issue closed.
7. Cleanup: toy issues #23/#24/#25 closed, toy worktrees + local branches removed, board items
   deleted (#23 during the run; #24/#25 after the hourly GraphQL reset, see notes).

Snapshot-consistency note (expected, matches fetch-once semantics): a gate read reusing a snapshot
fetched before the transitions still reported the old counts; the next fresh read (= next tick)
saw them. In production each tick fetches a fresh snapshot, so the gate lags a child's completion
by at most one tick.

## Decisions (yolo defaults)

- Parent waits in **Pending** (not Running, as the Edge phrasing suggested): Running's watchdog
  contract expects a live session and would flag a session-less parent blocked; a 7th board state
  would trigger the option-ID-recreation hazard. Documented in the design doc (D2).
- Gate fails OPEN (REST hiccup -> treated as a normal task) because `work-task` re-checks the gate
  and re-queues a prematurely spawned parent to Pending; fail-closed could wedge normal tasks.
- Toy children's pipeline states were driven via `board.sh status` rather than real spawned agents:
  the cron was paused and `maxConcurrent=1` was held by this very work agent, so real child agents
  could not run concurrently; the new code paths (gate, scan, spawn decision, handler routing) were
  all exercised for real.

## Notes & follow-ups

- The toy run burned the hourly GraphQL budget to 0 near the end (many standalone `board.sh` calls
  and snapshot refetches on top of the all-day tick baseline): the exact handoff §3 batching
  gotcha, now demonstrated twice on 2026-07-02. The tick guardrail handled it (throttled ticks
  until reset); final board ops waited for the reset.
- `sub_issues_summary` is eventually consistent and counts only CLOSED children; anything gating
  MUST use the `/sub_issues` list + board statuses (the design doc documents this).
