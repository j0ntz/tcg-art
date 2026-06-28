#!/usr/bin/env bash
# Verifying handler: ONE Verifying task per tick -> spawn the kind-appropriate verify skill,
# a FRESH agent independent of the builder. Code -> /verify-code (preview-test + PR review).
# Doc / ops -> /verify-doc (completeness + review; no preview to test). The agent routes out
# of Verifying with a binary verdict:
#   changes  -> Running (re-work);
#   pass + open PR  -> Verified (repo-bound, queues for landing);
#   pass + no PR     -> Done (research-only / board-ops, nothing to merge).
# Idempotent via the tmux presence-guard; skips `blocked`-labeled tasks.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"

num="$(first_item_in_state Verifying)"
[ -z "$num" ] && { echo "[verify] nothing in Verifying"; exit 0; }
has_label "$num" blocked && { echo "[verify] #$num blocked; skipping"; exit 0; }
session="claude-verify-$num"
tmux has-session -t "$session" 2>/dev/null && { echo "[verify] #$num: verify-agent already running"; exit 0; }
wt="$(ensure_worktree "$num")" || { echo "[verify] #$num: could not provision worktree"; exit 0; }

# Pick the verify skill by flavor: any doc/ops flavor -> verify-doc; default (code) -> verify-code.
skill="verify-code"
for f in research design instructions chore; do
  if has_label "$num" "$f"; then skill="verify-doc"; break; fi
done
spawn_agent "$session" "$wt" "/$skill https://github.com/$REPO/issues/$num"
echo "[verify] #$num: VERIFYING -> spawned $session ($skill)"
