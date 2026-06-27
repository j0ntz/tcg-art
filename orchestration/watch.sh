#!/usr/bin/env bash
# Minimal watcher tick for the agent orchestration.
# Polls the GitHub Projects board for Agent Status = Pending, provisions a
# worktree, marks the item Running, and spawns an autonomous
# `claude --dangerously-skip-permissions /run-task <issue-url>` in a tmux session.
# Run once by hand, or on a schedule (cron/launchd). Concurrency-capped.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
source "$HERE/lib.sh"   # REPO_NAME, WORKTREES, MAX, REPO from orch.config.json
# NB: WORKTREES must stay separate from the Edge orch's ~/git/.agent-worktrees (its watchdog GCs that dir every 120s)

live="$(tmux ls 2>/dev/null | grep -c '^claude-task-' || true)"
if [ "${live:-0}" -ge "$MAX" ]; then
  echo "concurrency cap reached ($live live >= $MAX); skipping tick"
  exit 0
fi

pending="$(bash "$HERE/board.sh" list-pending || true)"
if [ -z "$pending" ]; then
  echo "no pending tasks"
  exit 0
fi

git -C "$REPO_ROOT" fetch -q origin main

while IFS=$'\t' read -r num url; do
  [ -z "${num:-}" ] && continue
  session="claude-task-$num"
  if tmux has-session -t "$session" 2>/dev/null; then
    echo "#$num already has a live session; skipping"
    continue
  fi
  slug="task-$num"
  branch="jon/$slug"
  wt="$WORKTREES/$slug/$REPO_NAME"
  echo "=== picking up #$num ($url) ==="
  if [ ! -d "$wt" ]; then
    mkdir -p "$(dirname "$wt")"
    git -C "$REPO_ROOT" worktree add "$wt" -b "$branch" origin/main
    ln -s "$REPO_ROOT/node_modules" "$wt/node_modules"
  fi
  bash "$HERE/board.sh" status "$num" Running
  tmux new-session -d -s "$session"
  # interactive shell so ~/.zshrc (PATH, gh keyring) is sourced, then launch the agent
  tmux send-keys -t "$session" "cd \"$wt\" && claude --dangerously-skip-permissions \"/run-task $url\"" C-m
  echo "spawned $session  (attach: tmux attach -t $session  |  peek: tmux capture-pane -t $session -p)"
  break   # one spawn per tick while we babysit; remove to drain the queue
done <<< "$pending"
