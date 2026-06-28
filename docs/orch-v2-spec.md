# Orchestration v2 — build spec

Supersedes the v1 pipeline in `orchestration-plan.md`. Generalizes the orch from a code-PR factory into a task -> reviewed-deliverable engine that handles **code, repo docs, and board-ops**, forking on **PR-presence** rather than a hardcoded path.

## State machine (6 states)

```
Pending -> Running -> Verifying -> Verified -> Landing -> Done
                         |   ^            \__ auto-land bypasses Verified __/
                changes _|   |_ re-work
   no-PR (research / ops): Verifying --pass--> Done
```

| State | Meaning | In-progress? | Handler trigger |
|---|---|---|---|
| Pending | queued | no | watch -> work |
| Running | work active: build / write / ops, AND addressing verify feedback | live session | — |
| Verifying | independent check active | live session | verify -> verify-{code,doc} |
| Verified | clean PR awaiting the land decision (the one human gate; `auto-land` bypasses) | no | — (human or auto-land -> Landing) |
| Landing | lander merging the approved PR | live session | land -> land-task |
| Done | terminal (shared) | no | — |

- **In-progress is a live tmux session, not a state.** Field states are checkpoints/gates; the gerund states (Running, Verifying, Landing) are the ones that carry a session.
- **Loop:** Verifying finds changes -> back to Running; the work skill re-works and resolves the review threads.
- **The one human gate:** Verified -> Landing. `auto-land` bypasses it; Landing auto-merges -> Done. Tasks pile up in Verified as the "ready to merge" tray.

## Path fork (PR-presence, decided at runtime)

After Verifying passes:
- **Repo-bound** (Running opened a PR / committed a file) -> `Verified` -> `Landing` -> `Done`.
- **No-PR** (research-only findings, board-ops — nothing committed) -> `Done` directly.

Detected by `gh pr list --repo j0ntz/tcg-art --head jon/task-<n> --state open`: a PR exists -> repo-bound; none -> no-PR. Flavor does NOT decide the path.

## Labels

| Label | Role |
|---|---|
| `research` / `design` / `instructions` / `chore` | flavor — shapes the work skill and board visibility (absent = `code`). Decoupled from the path. |
| `auto-land` | bypass the Verified gate; once verification passes, go straight into Landing (fully hands-off) |
| `blocked` | stuck-flag on the *current* state (not a state). Handlers skip it; clear it to resume. Preserves *where* it stuck. |

Retired: `auto-review`, `in-review` (the Testing->Review gate they managed no longer exists).

## Skills

| Skill | Role | Replaces |
|---|---|---|
| `work-task` | do the work per flavor (code / doc / ops) AND address verify feedback (resolve the review threads) | run-task + address-task + research-task |
| `verify-code` | preview-test then independent PR review, binary verdict (changes -> Running, pass -> Verified/Done) | test-task + review-task |
| `verify-doc` | completeness check then independent review, binary verdict | (new) |
| `land-task` | merge a Landing-state PR with semantic conflict resolution -> Done | land-task (kept) |
| `validate-block` | gate before applying the `blocked` label | validate-block (kept; sets the label, not a state) |
| `/draft-task` | front door: intent + flavors -> structured issue -> board + Pending + labels | (new) |

Verify runs as a FRESH agent, independent of the builder. `work-task` is the only multi-purpose skill: it branches on flavor and on whether open review threads exist (initial work vs addressing).

## Handlers (the tick chain)

`watchdog -> watch (Pending) -> verify (Verifying) -> land (Landing)`. Each acts on one task per tick, is idempotent via a tmux session presence-guard, and **skips any task carrying `blocked`**. Removed: `test.sh`, `review.sh`, `address.sh`.

## Migration (old 10 states -> new 6)

Recreating the single-select options recreates all option IDs and clears item statuses, so: snapshot -> recreate -> restore -> update `orch.config.json`.

| Old | -> New |
|---|---|
| Pending | Pending |
| Running | Running |
| Coded, Review | Verifying |
| Testing, Reviewed | Verified |
| Address | Running |
| Land | Landing |
| Landed | Done |
| Blocked | resume-state + `blocked` label |

Current board remap (no in-flight tasks): #5, #7, #9 `Reviewed` -> `Verified`; #1, #3 `Landed` -> `Done`.

## First validation run

A **board-ops task** (no-PR of its own): "clean up the open tasks — address #5 and #7's review nits, push, and drive #5/#7/#9 through to Done." Runs `Pending -> Running (ops) -> Verifying (are they all landed?) -> Done`, exercising the no-PR path and `work-task`'s ops mode.
