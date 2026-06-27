#!/usr/bin/env bash
# Minimal pr-land for this repo. Lands board tasks in the "Land" state.
# ONE per tick (keeps landing strictly sequential: each merge moves main, the next
# task rebases onto the new main on a later tick).
#   - Clean rebase onto origin/main  -> deterministic squash-merge inline (no LLM).
#   - Rebase conflict                -> spawn a /land-task agent that resolves it
#                                       SEMANTICALLY and merges (no blocking on conflicts).
#   - Genuine non-conflict failure   -> Blocked + a comment.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
REPOPATH="$HOME/git/$REPO_NAME"

block() { bash "$HERE/board.sh" status "$1" Blocked >/dev/null 2>&1; gh issue comment "$1" --repo "$REPO" --body "Lander: $2" >/dev/null 2>&1; echo "[land] #$1 -> Blocked: $2"; }

# first Land task only (one per tick = sequential)
num="$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200 2>/dev/null \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));for(const it of d.items||[]){if(!it.content||!it.content.number)continue;const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));if((e?e[1]:"")==="Land"){console.log(it.content.number);break}}' 2>/dev/null || true)"
[ -z "$num" ] && { echo "[land] nothing in Land"; exit 0; }

# a semantic-resolution agent already handling this one? let it finish.
tmux has-session -t "claude-land-$num" 2>/dev/null && { echo "[land] #$num: land-agent resolving"; exit 0; }

branch="jon/task-$num"
url="https://github.com/$REPO/issues/$num"
pr="$(gh pr list --repo "$REPO" --head "$branch" --state open --json number -q '.[0].number' 2>/dev/null || true)"
[ -z "$pr" ] && { block "$num" "no open PR on $branch to land."; exit 0; }

# worktree on the PR head
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

if git -C "$wt" rebase origin/main >/dev/null 2>&1; then
  # clean rebase: deterministic land, no agent
  git -C "$wt" push --force-with-lease >/dev/null 2>&1 || { echo "[land] #$num: post-rebase push failed (retry next tick)"; exit 0; }
  if gh pr merge "$pr" --repo "$REPO" --squash --delete-branch >/dev/null 2>&1; then
    bash "$HERE/board.sh" status "$num" Landed >/dev/null 2>&1
    gh issue comment "$num" --repo "$REPO" --body "Landed: PR #$pr squash-merged to main (clean rebase)." >/dev/null 2>&1
    git -C "$REPOPATH" worktree remove --force "$wt" 2>/dev/null || true
    git -C "$REPOPATH" branch -D "$branch" 2>/dev/null || true
    echo "[land] #$num -> Landed (clean)"
  else
    block "$num" "squash-merge of PR #$pr failed for a non-conflict reason; inspect on GitHub."
  fi
else
  # conflict: hand off to a semantic-resolution agent (no blocking)
  git -C "$wt" rebase --abort 2>/dev/null || true
  session="claude-land-$num"
  tmux new-session -d -s "$session"
  tmux send-keys -t "$session" "cd \"$wt\" && claude --dangerously-skip-permissions \"/land-task $url\"" C-m
  echo "[land] #$num: rebase conflict -> spawned $session for semantic resolution"
fi
