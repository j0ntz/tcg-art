# Orchestration

The orchestration lives in the shared install at `~/git/site-orch` (repo [j0ntz/site-orch](https://github.com/j0ntz/site-orch)); its README is the current description of the whole system. This repo keeps only its side of the per-tenant contract:

- `orch.config.json` at the repo root (board ids, worktree root, model and effort options), registered with `~/git/site-orch/register.sh`.
- `.claude/skills/`: copies of the six orch skills, kept identical to `site-orch/skills` by `sync-skills.sh`.
- `orchestration/playwright/`: flows, still run by the package.json scripts.

Operate from this repo root with `~/git/site-orch/board.sh` (or after `eval "$(bash ~/git/site-orch/env.sh)"`), `install-watcher.sh status`, and `doctor.sh`. The design records that used to live under `docs/` here (the v2 state machine, the sub-issue design) moved to `site-orch/docs/`.
