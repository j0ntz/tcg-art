#!/usr/bin/env bash
# Pending handler: ONE Pending task per tick -> provision a worktree, mark Running, spawn
# /work-task. The work agent does the job per flavor (code / doc / ops) AND addresses any
# open review threads, then routes out of Running when done. Idempotent via the tmux
# presence-guard; skips tasks carrying the `blocked` label. A PARENT task (has sub-issues)
# is held in Pending until every child is complete (children_gate; docs/orch-subtasks-design.md),
# so candidates are scanned in board order for the first ELIGIBLE one. Concurrency-capped
# across all agent stages (work/verify/land).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"

live="$(tmux ls 2>/dev/null | grep -cE '^claude-(work|verify|land)-' || true)"
if [ "${live:-0}" -ge "$MAX" ]; then echo "[watch] concurrency cap ($live >= $MAX); skipping"; exit 0; fi

num=""
while IFS=$'\t' read -r cand _url; do
  [ -z "${cand:-}" ] && continue
  has_label "$cand" blocked && { echo "[watch] #$cand blocked; skipping"; continue; }
  tmux has-session -t "claude-work-$cand" 2>/dev/null && { echo "[watch] #$cand: work-agent already running; skipping"; continue; }
  gate="$(children_gate "$cand")"
  case "$gate" in
    waiting:*) echo "[watch] #$cand parent waiting (${gate#waiting:} children complete)"; continue ;;
    ready)     echo "[watch] #$cand parent gate open (all children complete)" ;;
  esac
  num="$cand"; break
done < <(bash "$HERE/board.sh" list-pending 2>/dev/null)
[ -z "$num" ] && { echo "[watch] nothing eligible in Pending"; exit 0; }
session="claude-work-$num"

# Pending is the only stage that may need a NEW branch off main (re-entry from Verifying reuses
# the existing branch); ensure_worktree assumes an existing origin branch, so provision here.
slug="task-$num"; branch="jon/$slug"; wt="$WORKTREES/$slug/$REPO_NAME"; repo="$HOME/git/$REPO_NAME"
if [ ! -d "$wt" ]; then
  git -C "$repo" fetch -q origin main 2>/dev/null || true
  mkdir -p "$(dirname "$wt")"
  git -C "$repo" worktree add "$wt" -b "$branch" origin/main 2>/dev/null \
    || git -C "$repo" worktree add "$wt" "$branch" 2>/dev/null \
    || git -C "$repo" worktree add --force -B "$branch" "$wt" "origin/$branch" 2>/dev/null \
    || { echo "[watch] #$num: could not provision worktree"; exit 0; }
  [ -e "$wt/node_modules" ] || ln -s "$repo/node_modules" "$wt/node_modules" 2>/dev/null || true
fi

bash "$HERE/board.sh" status "$num" Running
spawn_agent "$session" "$wt" "/work-task https://github.com/$REPO/issues/$num"
echo "[watch] #$num: PENDING -> Running, spawned $session"
