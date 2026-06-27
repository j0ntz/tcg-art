# Orchestration handoff

Written 2026-06-27 to hand this work to the persistent (RC) pokemon session. To continue: read this, then `docs/orchestration-plan.md` (design source of truth) and `CLAUDE.md` (repo conventions). The full review/test/land pipeline (§2) is now BUILT and smoke-tested; §3 is the hard-won gotchas; §4 is the file map.

## 1. What's built and live (on `main`)

The autonomous loop is proven end to end (board -> cron -> agent -> verified PR -> run report), all on the Claude Max subscription (no API billing).

- **Backend:** GitHub Projects board "Agent Orchestration" (project #1, user `j0ntz`). State lives in a native single-select **Agent Status** field (NOT labels). 10 options: Pending, Running, Coded, Testing, Review, Address, Reviewed, Land, Landed, Blocked. Labels are tags only: `blocked`, `auto-review`, `in-review`.
- **Cron:** launchd `com.tcg-art.orch`, every 60s, runs `orchestration/tick.sh` = rate-limit guardrail -> fetch board once -> `watchdog.sh` + `watch.sh` + `test.sh` + `review.sh` + `address.sh` + `land.sh`. Stop with `orchestration/install-watcher.sh uninstall`.
- **Skills** (`.claude/skills/`, repo-local, all unique names): `run-task` (code + PR -> Coded), `test-task` (verify preview + run report -> Testing/Review), `review-task` (independent local PR review -> Reviewed/Address), `address-task` (address review + re-enter Coded), `validate-block` (true-blocker validator), `land-task` (semantic-resolution merge). Spawned via `claude --dangerously-skip-permissions "/<skill> <issue-url>"` in tmux.
- **Vercel:** account `jontz` (linked to `j0ntz` GitHub), project `tcg-art`, deployment protection DISABLED (public previews). `verify-preview.sh <pr#> "<expected>"` resolves the preview URL via the GitHub Deployments API, asserts live, headless-Chrome screenshot.
- **Config:** `orchestration/orch.config.json` (+ `lib.sh` loader). Board ids, Vercel scope, merge method (squash), worktrees root, concurrency -- all swappable here.

## 2. The review / test / land pipeline (BUILT 2026-06-27, smoke-tested)

**States (10):** Pending, Running, **Coded**, **Testing**, **Review**, **Address**, **Reviewed**, Land, Landed, Blocked. (Done was renamed Coded.)

**Transitions** (auto unless marked "you"). Each handler acts on ONE task per tick and is idempotent via a tmux session presence-guard (it advances state OUT of its trigger state; while the agent runs, re-spawn is skipped):

- Pending -(watch.sh)-> Running -(`/run-task`: code + local-build gate + PR)-> **Coded**.
- **Coded** -(test.sh -> `/test-task`)-> verify on the Vercel preview (fix-on-fail), attach the run report -> **Testing**; then auto-advance -> **Review** IF the task has `auto-review` (primed at creation) or `in-review` (loop active), else it waits for "you" to move Testing -> Review. Genuine wall -> **Blocked** (validated).
- **Review** -(review.sh -> `/review-task`)-> INDEPENDENT local review (fresh agent, NOT the builder; on the subscription, NOT cloud `/code-review ultra`), posted to the PR via `gh`. Clean -> **Reviewed** (clears `in-review`). Actionable issues -> sets `in-review`, -> **Address**.
- **Address** -(address.sh -> `/address-task`)-> fix the blocking findings, reply, push, then re-enter at **Coded**. Because `in-review` is set, the re-test auto-advances Testing -> Review, closing the loop. Loop caps at 2 rounds -> **Blocked** (validated).
- **Reviewed** -("you", ALWAYS manual)-> **Land** -(land.sh)-> **Landed**.
- **Blocked**: reachable from any state; every agent runs `/validate-block` first and obeys the verdict (soft enforcement; the harder PreToolUse-hook gate is a follow-up).

**Human touchpoints only:** create the task; `Testing -> Review` (unless `auto-review`); `Reviewed -> Land` (always). Everything else is the orch.

**Design note (refined during the build):** Address re-enters at **Coded**, not Testing, so the single Coded-triggered test handler is reused for the loop re-test (the `in-review` label is what makes the loop's Testing -> Review automatic). The fresh-agent per stage (own tmux session, cold context, worktree synced to origin) gives independence: the reviewer never wrote the code it reviews.

**Sessions:** `claude-task-<n>` (run-task), `claude-test-<n>`, `claude-review-<n>`, `claude-address-<n>`, `claude-land-<n>`. The watchdog maps each active state to its expected session: frozen -> kill (Running also -> Blocked; others re-spawn), Running with a dead session -> Blocked, and it retires any stale session whose state has moved on.

## 3. Gotchas (hard-won -- these WILL bite if unknown)

- **Skill names must be unique.** The global `slash-command-detection` rule (`~/.claude/CLAUDE.md`, from `~/.cursor/rules`) hardcodes "/word -> read `~/.cursor/skills/<word>/SKILL.md`". The repo `CLAUDE.md` overrides to prefer repo-local, but reuse a name that exists in `~/.cursor/skills` (e.g. `pr-review`, `pr-address`, `one-shot`) and you risk the Edge skill loading instead. That is exactly why the skills are `run-task` / `test-task` / `review-task` / `address-task`, not `pr-review` / `pr-address`.
- **Spawn flag is `--dangerously-skip-permissions`**, not `--yolo` (doesn't exist in this claude version).
- **Worktrees go in `~/git/.tcg-art-worktrees`**, NOT `~/git/.agent-worktrees` -- the Edge watchdog GCs the latter and will delete them mid-run. Sessions named `claude-{task,test,review,address,land}-*` so the Edge watchdog (which only manages `claude-asana-*`) ignores them.
- **Spawn agents with cwd INSIDE the repo/worktree** (`cd` first) or `.claude/` skills are not discovered. `lib.sh`'s `spawn_agent` does this.
- **Editing the Projects single-select field's options via the API RECREATES all option IDs and clears existing items' statuses.** Snapshot item statuses + option IDs first, then restore. (Hit this twice; recovered both.)
- **GraphQL budget is account-wide, Projects is GraphQL-only, a board read is ~31 pts** (of 5000/hr). Hence fetch-once (`ORCH_BOARD_SNAPSHOT`) + the `rate_limit` reserve guardrail in `tick.sh`. The `gh api rate_limit` endpoint is FREE.
- **`sfw` wrapper:** bare `npm`/`npx`/`yarn` are blocked -- prefix with `sfw`. The `sfw` hook also rejects a heredoc that contains the literal word "npm" -- write such files (PR/issue comment bodies) with the editor, not `cat <<EOF`. The review/address skills are told to use `--body-file` written with the editor.
- **launchctl** may need the user's GUI session; if `install-watcher.sh install` fails from a headless context, run it from a Terminal.
- **Mergeability race:** never force-push then immediately `gh pr merge` (GitHub returns mergeable=UNKNOWN and the merge fails). Use GitHub's computed mergeability (`gh pr view --json mergeable,mergeStateStatus`) -- the lander already does.

## 4. File map + how to operate

- `orchestration/`: `lib.sh` (config loader + `board_items_json` + label helpers + `first_item_in_state` / `ensure_worktree` / `spawn_agent`), `board.sh` (board read/write + `has-label`/`add-label`/`remove-label`), `tick.sh` (guardrail + fetch-once + run all handlers), `watch.sh`, `test.sh`, `review.sh`, `address.sh`, `land.sh`, `watchdog.sh`, `verify-preview.sh`, `install-watcher.sh`, `orch.config.json`, `templates/run-report.md`.
- `.claude/skills/`: `run-task/`, `test-task/`, `review-task/`, `address-task/`, `validate-block/`, `land-task/`.
- **Queue a task:** open an issue in `j0ntz/tcg-art`, add it to project #1, `board.sh status <n> Pending`. Add the `auto-review` label to prime it for automatic review (else it pauses at Testing for your nod).
- **Watch:** `tail ~/.config/tcg-orch/tick.log`, or the board at https://github.com/users/j0ntz/projects/1.
- **Stop the cron:** `orchestration/install-watcher.sh uninstall`.

## 5. Open follow-ups

- **Harder validator enforcement:** a project `PreToolUse` hook gating `board.sh status ... Blocked` (like Edge's `require-concession-validation.sh`), instead of the current soft "agent must call `/validate-block`".
- **Retry cap on handler-agent crashes:** Coded/Review/Address re-spawn indefinitely if the agent keeps dying; add a per-issue per-state attempt counter -> Blocked after N.
- Clean-path land skips re-verify-after-rebase (add a config flag if you want it).
- `review-task` reviews on its own judgment; consider wiring the built-in `/code-review` analysis into it for consistency if its output proves usable in an unattended agent.
