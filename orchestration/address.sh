#!/usr/bin/env bash
# Address handler: ONE Address task per tick -> spawn /address-task (fix the review's blocking
# findings, reply, push, re-enter at Coded). The agent routes out of Address (-> Coded, or Blocked
# if the loop won't converge), so this is idempotent via the presence guard.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"

num="$(first_item_in_state Address)"
[ -z "$num" ] && { echo "[address] nothing in Address"; exit 0; }
session="claude-address-$num"
tmux has-session -t "$session" 2>/dev/null && { echo "[address] #$num: address-agent already running"; exit 0; }
wt="$(ensure_worktree "$num")" || { echo "[address] #$num: could not provision worktree"; exit 0; }
spawn_agent "$session" "$wt" "/address-task https://github.com/$REPO/issues/$num"
echo "[address] #$num: ADDRESS -> spawned $session (address review + re-enter Coded)"
