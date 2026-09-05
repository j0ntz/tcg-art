# Orchestration

The orchestration scripts moved to the shared install at `~/git/site-orch` (repo `j0ntz/site-orch`) on 2026-09-04. This repo keeps only:

- `orch.config.json` at the repo root (board ids, worktree root, model and effort options), registered with `~/git/site-orch/register.sh`.
- `.claude/skills/` copies of the six orch skills, kept identical to `site-orch/skills` by `sync-skills.sh`.
- `orchestration/playwright/` flows, still run by the package.json scripts.

Operate with `~/git/site-orch/board.sh` (from this repo root, or after `eval "$(bash ~/git/site-orch/env.sh)"`), `install-watcher.sh status`, and `doctor.sh`. The design docs under `docs/` (orch-v2-spec, orch-subtasks-design, bring-up, handoff) describe the same state machine; their `orchestration/<script>` paths now resolve under `~/git/site-orch/`.
