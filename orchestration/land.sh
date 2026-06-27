#!/usr/bin/env bash
# Minimal pr-land for this repo. Lands board tasks in the "Land" state, ONE per tick
# (sequential: each merge moves main, the next task is re-evaluated against it next tick).
# Uses GitHub's COMPUTED mergeability (no local rebase/force-push, so no post-push race):
#   MERGEABLE   -> squash-merge onto latest main (GitHub applies the diff) -> Landed
#   CONFLICTING -> spawn a /land-task agent for SEMANTIC resolution (no blocking)
#   UNKNOWN     -> GitHub still computing mergeability; retry next tick
#   other       -> Blocked (genuine non-conflict wall)
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
REPOPATH="$HOME/git/$REPO_NAME"
block() { bash "$HERE/board.sh" status "$1" Blocked >/dev/null 2>&1; gh issue comment "$1" --repo "$REPO" --body "Lander: $2" >/dev/null 2>&1; echo "[land] #$1 -> Blocked: $2"; }

num="$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200 2>/dev/null \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));for(const it of d.items||[]){if(!it.content||!it.content.number)continue;const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));if((e?e[1]:"")==="Land"){console.log(it.content.number);break}}' 2>/dev/null || true)"
[ -z "$num" ] && { echo "[land] nothing in Land"; exit 0; }
tmux has-session -t "claude-land-$num" 2>/dev/null && { echo "[land] #$num: land-agent resolving"; exit 0; }

branch="jon/task-$num"
url="https://github.com/$REPO/issues/$num"
read -r pr mergeable state < <(gh pr list --repo "$REPO" --head "$branch" --state open --json number,mergeable,mergeStateStatus -q '.[0] | "\(.number) \(.mergeable) \(.mergeStateStatus)"' 2>/dev/null || true)
[ -z "${pr:-}" ] && { block "$num" "no open PR on $branch to land."; exit 0; }
echo "[land] #$num PR #$pr mergeable=$mergeable state=$state"

case "${mergeable:-}" in
  MERGEABLE)
    if gh pr merge "$pr" --repo "$REPO" "--$MERGE_METHOD" --delete-branch >/dev/null 2>&1; then
      bash "$HERE/board.sh" status "$num" Landed >/dev/null 2>&1
      gh issue comment "$num" --repo "$REPO" --body "Landed: PR #$pr $MERGE_METHOD-merged to main (clean)." >/dev/null 2>&1
      git -C "$REPOPATH" worktree remove --force "$WORKTREES/task-$num/$REPO_NAME" 2>/dev/null || true
      git -C "$REPOPATH" branch -D "$branch" 2>/dev/null || true
      echo "[land] #$num -> Landed (clean, PR #$pr)"
    else
      block "$num" "squash-merge of PR #$pr failed though GitHub reported it MERGEABLE; inspect."
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
        || { block "$num" "could not provision a worktree for $branch."; exit 0; }
    fi
    session="claude-land-$num"
    tmux new-session -d -s "$session"
    tmux send-keys -t "$session" "cd \"$wt\" && claude --dangerously-skip-permissions \"/land-task $url\"" C-m
    echo "[land] #$num: CONFLICTING -> spawned $session for semantic resolution"
    ;;
  UNKNOWN|"")
    echo "[land] #$num: mergeability still computing; retry next tick"
    ;;
  *)
    block "$num" "PR #$pr not mergeable (mergeable=$mergeable, state=$state)."
    ;;
esac
