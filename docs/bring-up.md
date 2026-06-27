# Bringing the orchestration up on a new machine

The tcg-art orchestration is self-contained in this repo. A fresh Mac is one clone plus one command:

```bash
git clone https://github.com/j0ntz/tcg-art.git ~/git/tcg-art
cd ~/git/tcg-art
orchestration/bootstrap.sh
```

`bootstrap.sh` is idempotent (safe to re-run). It installs deps, ensures the gh `project` scope, runs `doctor.sh` as a gate, arms the launchd cron, and verifies a clean tick before declaring success.

## Prerequisites

- **macOS.** The cron is a launchd LaunchAgent; the Testing phase drives headless Chrome.
- **Tools:** `git`, `gh`, `node`, `npm`, `tmux`, `jq`, `claude`, and Google Chrome. `doctor.sh` checks each and prints the fix for any that are missing.
- **gh authenticated** as the repo owner (`j0ntz`) with the `project` scope. `bootstrap.sh` runs `gh auth refresh -s project` if it is absent.
- **Global Edge conventions** (an external dependency, NOT in this repo): the spawned per-stage agents load `~/.claude/CLAUDE.md` + `~/.cursor` skills/rules on top of this repo's `CLAUDE.md`. Bring them up by cloning `edge-dev-agents` and running its `./bootstrap.sh`. `doctor.sh` warns if `~/.claude/CLAUDE.md` or `sfw` is missing.

## The scripts

- **`orchestration/doctor.sh`** — read-only preflight. Verifies every prerequisite (tools, gh + `project` scope, `node_modules`, board reachable, cron health) and prints the exact fix for each failure. Exits non-zero if any required check fails. Run it any time to diagnose.
- **`orchestration/bootstrap.sh`** — one-command bring-up: deps -> gh scope -> doctor (gate) -> arm cron -> verify a clean tick.
- **`orchestration/install-watcher.sh install`** — arms the cron. Bakes `HOME` and a node-inclusive `PATH` into the plist so the job runs correctly in launchd's bare environment.

## Gotchas this package now handles (learned the hard way, 2026-06-27)

| Symptom | Cause | Handled by |
|---|---|---|
| Ticks log `node: command not found` and `board fetch failed` every minute | launchd runs the job with no `HOME` and a minimal `PATH`, so `lib.sh`'s `$HOME/...` paths and node (often nvm-managed, not in `/opt/homebrew/bin`) do not resolve | `install-watcher.sh` bakes `HOME` + node's dir into the plist `EnvironmentVariables` |
| `board.sh` / the tick cannot read the board | gh token lacks the `project` scope (the board is Projects-GraphQL only) | `doctor.sh` flags it; `bootstrap.sh` runs `gh auth refresh -s project` |
| Builds fail inside per-task worktrees | `node_modules` absent (worktrees symlink to the main checkout's) | `bootstrap.sh` runs `npm install` |
| `convention-sync` silently reports "in sync" while the machine is stale | the `edge-dev-agents` remote fetched over SSH, which fails on a machine without an authorized key, and the sync falls back to "0 ahead" on a failed fetch | set that remote's fetch URL to HTTPS (`git remote set-url origin https://...`). Unrelated to this repo, but it masked a 10-commit lag during bring-up |

## Operating

- **Watch:** `tail -f ~/.config/tcg-orch/tick.log`, or the board at https://github.com/users/j0ntz/projects/1
- **Health check:** `orchestration/doctor.sh`
- **Stop:** `orchestration/install-watcher.sh uninstall`
- **Queue a task:** open an issue in `j0ntz/tcg-art`, add it to project #1, `bash orchestration/board.sh status <n> Pending` (add the `auto-review` label to run hands-off through to Reviewed).
