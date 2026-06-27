# Orchestration handoff

Written 2026-06-27 to hand this work to the persistent (RC) pokemon session. To continue: read this, then `docs/orchestration-plan.md` (design source of truth) and `CLAUDE.md` (repo conventions). Section 2 is the only thing not yet built; sections 1/3/4 are context + traps.

## 1. What's built and live (on `main`)

The autonomous loop is proven end to end (board -> cron -> agent -> verified PR -> run report -> Done), all on the Claude Max subscription (no API billing).

- **Backend:** GitHub Projects board "Agent Orchestration" (project #1, user `j0ntz`). State lives in a native single-select **Agent Status** field (we deliberately did NOT use labels for state). Current options: Pending, Running, Blocked, Done, Land, Landed.
- **Cron:** launchd `com.tcg-art.orch`, every 60s, runs `orchestration/tick.sh` = rate-limit guardrail -> fetch board once -> `watchdog.sh` + `watch.sh` + `land.sh`. Stop with `orchestration/install-watcher.sh uninstall`.
- **Skills** (`.claude/skills/`, repo-local): `run-task` (implement -> verify on preview -> PR -> run report -> Done) and `land-task` (semantic-resolution merge on conflict). Spawned via `claude --dangerously-skip-permissions "/<skill> <issue-url>"` in tmux.
- **Lander:** `land.sh`, one Land task per tick (sequential). Clean rebase -> deterministic squash-merge; conflict -> spawn `land-task` agent. `land.mergeMethod` = squash (configurable).
- **Vercel:** account `jontz` (linked to `j0ntz` GitHub), project `tcg-art`, deployment protection DISABLED (public previews). `verify-preview.sh <pr#>` resolves the preview URL via the GitHub Deployments API, asserts live, headless-Chrome screenshot.
- **Run reports:** `run-task` posts an Asana-style report on the board issue (live preview link + screenshots + PR link). Template: `orchestration/templates/run-report.md`.
- **Config:** `orchestration/orch.config.json` (+ `lib.sh` loader). Board ids, Vercel scope, merge method, worktrees root, concurrency -- all swappable here.

## 2. NEXT BUILD (confirmed this session, NOT yet built): review / test / land pipeline

Extend the state machine to insert testing + a Claude-review loop before landing.

**States (10):** Pending, Running, **Coded**, **Testing**, **Review**, **Address**, **Reviewed**, Land, Landed, Blocked.
- Rename **Done -> Coded** (= implemented + PR open, pre-test).
- New: **Testing, Review, Address, Reviewed**.

**Transitions** (auto unless marked "you"):
- Pending -(watcher)-> Running -(agent codes + opens PR)-> **Coded** -> **Testing**
- **Testing**: runs `verify-preview`. pass -> rest, then **Review** ("you", OR auto if the task carries the `auto-review` label). fail / true wall -> **Blocked** (validated).
- **Review** (`/review-task` runs the native `/code-review` on the PR, posts inline comments): clean -> **Reviewed**; issues -> **Address**.
- **Address** (`/address-task`: address comments via reply + fixup commits, ported from Edge `/pr-address`) -> **Testing** (re-verify the fixes) -> **Review** (re-review). Loop caps at ~2 rounds, then **Blocked**.
- **Reviewed** -("you", ALWAYS manual)-> **Land** -(lander)-> **Landed**.
- **Blocked**: reachable from any state; validator-gated.

**Human touchpoints only:** create the task; `Testing -> Review` (unless `auto-review`); `Reviewed -> Land` (always). Everything else is the orch.

**Build steps:**
1. **Field options (SNAPSHOT FIRST -- editing recreates ALL option IDs and clears item statuses, see 3):** add Testing/Review/Address/Reviewed, rename Done->Coded, order them per the list above. Then refresh `orch.config.json` `statusOptions` with the new IDs and restore any cleared item statuses.
2. **Labels** (`gh label create`): `blocked` (board.sh adds on ->Blocked, removes on leaving) and `auto-review` (prime flag set at task creation; read by the Testing->Review gate).
3. **Trim `run-task`** to stop at **Coded** (implement + PR, NO verify) -- verify moves into the Testing handler.
4. **New skills** (`.claude/skills/`, UNIQUE names -- see 3): `/review-task`, `/address-task`, `/validate-block`.
5. **Handlers in the tick** (`test.sh`, `review.sh`, `address.sh`): each acts on its state and is **idempotent per PR HEAD** (only run if not already done for the current head SHA -- compare the agent's last comment/commit to the head commit, like the run-report watermark). `test.sh`: Coded->Testing, run verify-preview, pass->Review (auto if primed) / fail->Blocked. `review.sh`: spawn `/review-task`; clean->Reviewed, issues->Address. `address.sh`: spawn `/address-task`->Testing.
6. **Validator:** `/validate-block` skill; every skill MUST call it before setting Blocked and obey the verdict (soft). Harder option (follow-up): a project `PreToolUse` hook gating `board.sh status ... Blocked`, like Edge's `require-concession-validation.sh`.
7. **board.sh:** manage the `blocked` label; the Testing->Review gate checks the `auto-review` label.
8. Update `orchestration-plan.md` + memory.

## 3. Gotchas (hard-won -- these WILL bite if unknown)

- **Skill names must be unique.** The global `slash-command-detection` rule (`~/.claude/CLAUDE.md`, from `~/.cursor/rules`) hardcodes "/word -> read `~/.cursor/skills/<word>/SKILL.md`". The repo `CLAUDE.md` overrides to prefer repo-local, but reuse a name that exists in `~/.cursor/skills` (e.g. `pr-review`, `pr-address`, `one-shot`) and you risk the Edge skill loading instead. Keep unique names.
- **Spawn flag is `--dangerously-skip-permissions`**, not `--yolo` (doesn't exist in this claude version).
- **Worktrees go in `~/git/.tcg-art-worktrees`**, NOT `~/git/.agent-worktrees` -- the Edge watchdog GCs the latter and will delete them mid-run. Sessions named `claude-task-*` / `claude-land-*` so the Edge watchdog (which only manages `claude-asana-*`) ignores them.
- **Spawn agents with cwd INSIDE the repo/worktree** (`cd` first) or `.claude/` skills are not discovered.
- **Editing the Projects single-select field's options via the API RECREATES all option IDs and clears existing items' statuses.** Snapshot item statuses + option IDs first, then restore. (Hit this twice; recovered both.)
- **GraphQL budget is account-wide, Projects is GraphQL-only, a board read is ~31 pts** (of 5000/hr). Hence fetch-once (`ORCH_BOARD_SNAPSHOT`) + the `rate_limit` reserve guardrail in `tick.sh`. The `gh api rate_limit` endpoint is FREE.
- **`sfw` wrapper:** bare `npm`/`npx`/`yarn` are blocked -- prefix with `sfw`. The `sfw` hook also rejects a heredoc that contains the literal word "npm" -- write such files with the editor, not `cat <<EOF`.
- **launchctl** may need the user's GUI session; if `install-watcher.sh install` fails from a headless context, run it from a Terminal.
- **Mergeability race:** never force-push then immediately `gh pr merge` (GitHub returns mergeable=UNKNOWN and the merge fails). Use GitHub's computed mergeability (`gh pr view --json mergeable,mergeStateStatus`) -- the lander already does.

## 4. File map + how to operate

- `orchestration/`: `lib.sh` (config loader + `board_items_json`), `board.sh` (board read/write), `tick.sh` (guardrail + fetch-once + run handlers), `watch.sh`, `watchdog.sh`, `land.sh`, `verify-preview.sh`, `install-watcher.sh`, `orch.config.json`, `templates/run-report.md`.
- `.claude/skills/`: `run-task/`, `land-task/` (add `review-task/`, `address-task/`, `validate-block/`).
- **Queue a task:** open an issue in `j0ntz/tcg-art`, add it to project #1, `board.sh status <n> Pending` (add the `auto-review` label to prime it once that's built).
- **Watch:** `tail ~/.config/tcg-orch/tick.log`, or the board at https://github.com/users/j0ntz/projects/1.
- **Stop the cron:** `orchestration/install-watcher.sh uninstall`.

## 5. Open follow-ups

- Watchdog should also frozen-sweep `claude-land-*` (and the coming `claude-review-*` / `claude-address-*`) sessions.
- Clean-path land skips re-verify-after-rebase (add a config flag if you want it).
- Harder validator enforcement via a `PreToolUse` hook.
- The review/test/land pipeline in section 2.
