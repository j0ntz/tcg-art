#!/usr/bin/env bash
# Landing handler (v2): lands board tasks in the "Landing" state, ONE per tick (sequential:
# each merge moves main, the next is re-evaluated next tick). Uses GitHub's COMPUTED
# mergeability (no local rebase/force-push, so no post-push race):
#   MERGEABLE   -> squash-merge onto latest main -> Done
#   CONFLICTING -> spawn a /land-task agent for SEMANTIC resolution (no blocking)
#   UNKNOWN     -> GitHub still computing mergeability; retry next tick
#   other       -> flag `blocked` (stays in Landing so you see where)
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
REPOPATH="$HOME/git/$REPO_NAME"
flag_blocked() { add_label "$1" blocked >/dev/null 2>&1; gh issue comment "$1" --repo "$REPO" --body "Lander: $2" >/dev/null 2>&1; echo "[land] #$1 -> blocked: $2"; }

num="$(first_item_in_state Landing)"
[ -z "$num" ] && { echo "[land] nothing in Landing"; exit 0; }
has_label "$num" blocked && { echo "[land] #$num blocked; skipping"; exit 0; }
tmux has-session -t "claude-land-$num" 2>/dev/null && { echo "[land] #$num: land-agent resolving"; exit 0; }

branch="jon/task-$num"
url="https://github.com/$REPO/issues/$num"
read -r pr mergeable state < <(gh pr list --repo "$REPO" --head "$branch" --state open --json number,mergeable,mergeStateStatus -q '.[0] | "\(.number) \(.mergeable) \(.mergeStateStatus)"' 2>/dev/null || true)
[ -z "${pr:-}" ] && { flag_blocked "$num" "no open PR on $branch to land."; exit 0; }
echo "[land] #$num PR #$pr mergeable=$mergeable state=$state"

case "${mergeable:-}" in
  MERGEABLE)
    if gh pr merge "$pr" --repo "$REPO" "--$MERGE_METHOD" --delete-branch >/dev/null 2>&1; then
      bash "$HERE/board.sh" status "$num" Done >/dev/null 2>&1
      gh issue comment "$num" --repo "$REPO" --body "Done: PR #$pr $MERGE_METHOD-merged to main (clean)." >/dev/null 2>&1
      git -C "$REPOPATH" worktree remove --force "$WORKTREES/task-$num/$REPO_NAME" 2>/dev/null || true
      git -C "$REPOPATH" branch -D "$branch" 2>/dev/null || true
      echo "[land] #$num -> Done (clean, PR #$pr)"
    else
      flag_blocked "$num" "squash-merge of PR #$pr failed though GitHub reported it MERGEABLE; inspect."
    fi
    ;;
  CONFLICTING)
    wt="$WORKTREES/task-$num/$REPO_NAME"
    git -C "$REPOPATH" fetch -q origin 2>/dev/null || true
    if [ -d "$wt" ]; then
      git -C "$wt" fetch -q origin 2>/dev/null || true
      git -C "$wt" checkout -q "$branch" 2>/dev/null || true
      git -C "$wt" reset -q --hard "origin/$branch" 2>/dev/null || true
    else
      mkdir -p "$(dirname "$wt")"
      git -C "$REPOPATH" worktree add "$wt" "$branch" 2>/dev/null \
        || git -C "$REPOPATH" worktree add --force -B "$branch" "$wt" "origin/$branch" 2>/dev/null \
        || { flag_blocked "$num" "could not provision a worktree for $branch."; exit 0; }
    fi
    session="claude-land-$num"
    tmux new-session -d -s "$session"
    tmux send-keys -t "$session" "cd \"$wt\" && claude --remote-control \"$session\" --dangerously-skip-permissions \"/land-task $url\"" C-m
    echo "[land] #$num: CONFLICTING -> spawned $session for semantic resolution"
    ;;
  UNKNOWN|"")
    echo "[land] #$num: mergeability still computing; retry next tick"
    ;;
  *)
    flag_blocked "$num" "PR #$pr not mergeable (mergeable=$mergeable, state=$state)."
    ;;
esac
