#!/usr/bin/env bash
# Review handler: ONE Review task per tick -> spawn /review-task (independent local review of the PR,
# posted to the PR via gh). The agent routes out of Review (clean -> Reviewed, issues -> Address),
# so this is idempotent via the presence guard.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"

num="$(first_item_in_state Review)"
[ -z "$num" ] && { echo "[review] nothing in Review"; exit 0; }
session="claude-review-$num"
tmux has-session -t "$session" 2>/dev/null && { echo "[review] #$num: review-agent already running"; exit 0; }
wt="$(ensure_worktree "$num")" || { echo "[review] #$num: could not provision worktree"; exit 0; }
spawn_agent "$session" "$wt" "/review-task https://github.com/$REPO/issues/$num"
echo "[review] #$num: REVIEW -> spawned $session (independent PR review)"
