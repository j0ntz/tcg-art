#!/usr/bin/env bash
# Testing handler: ONE Coded task per tick -> spawn /test-task (verify on the Vercel preview,
# fix-on-fail, attach the run report). The agent advances state out of Coded (-> Testing, then
# Review if primed), so this is idempotent: while the agent runs, the presence guard skips
# re-spawn; once it finishes, the item is no longer Coded and won't be picked again.
# (Address re-enters at Coded with the new HEAD, which is how the review loop re-tests.)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"

num="$(first_item_in_state Coded)"
[ -z "$num" ] && { echo "[test] nothing in Coded"; exit 0; }
session="claude-test-$num"
tmux has-session -t "$session" 2>/dev/null && { echo "[test] #$num: test-agent already running"; exit 0; }
wt="$(ensure_worktree "$num")" || { echo "[test] #$num: could not provision worktree"; exit 0; }
spawn_agent "$session" "$wt" "/test-task https://github.com/$REPO/issues/$num"
echo "[test] #$num: CODED -> spawned $session (verify preview + run report)"
