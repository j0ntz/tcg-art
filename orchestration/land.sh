#!/usr/bin/env bash
# Lander: land PRs from board tasks in the "Land" state.
# Sequentially (each merge moves main, so the next PR rebases onto the NEW main):
#   resolve the task's open PR -> rebase its branch onto origin/main -> force-push
#   -> squash-merge -> set Landed, delete branch + worktree.
# Rebase conflict or un-mergeable -> Blocked + a one-line comment (human resolves, re-sets Land).
# Deterministic git/gh only (no LLM). Run from the cron tick; idempotent.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"
REPOPATH="$HOME/git/$REPO_NAME"

land_nums="$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200 2>/dev/null \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));for(const it of d.items||[]){if(!it.content||!it.content.number)continue;const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));if((e?e[1]:"")==="Land")console.log(it.content.number)}' 2>/dev/null || true)"
[ -z "$land_nums" ] && { echo "[land] nothing in Land"; exit 0; }

block() { bash "$HERE/board.sh" status "$1" Blocked >/dev/null 2>&1; gh issue comment "$1" --repo "$REPO" --body "Lander: $2" >/dev/null 2>&1; echo "[land] #$1 -> Blocked: $2"; }

for num in $land_nums; do
  echo "[land] processing #$num"
  branch="jon/task-$num"
  pr="$(gh pr list --repo "$REPO" --head "$branch" --state open --json number -q '.[0].number' 2>/dev/null || true)"
  [ -z "$pr" ] && { block "$num" "no open PR on $branch to land."; continue; }

  # worktree on the PR branch, reset to the pushed PR head
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
      || { block "$num" "could not provision a worktree for $branch."; continue; }
  fi

  # rebase onto the latest main (sequential: previous merges already moved origin/main)
  if ! git -C "$wt" rebase origin/main >/dev/null 2>&1; then
    git -C "$wt" rebase --abort 2>/dev/null || true
    block "$num" "rebase onto main hit conflicts. Resolve on $branch, push, then set Land again."
    continue
  fi
  git -C "$wt" push --force-with-lease >/dev/null 2>&1 || { block "$num" "force-push after rebase failed (branch moved underneath)."; continue; }

  # squash-merge
  if ! gh pr merge "$pr" --repo "$REPO" --squash --delete-branch >/dev/null 2>&1; then
    block "$num" "squash-merge of PR #$pr failed (not mergeable / required checks). Inspect on GitHub."
    continue
  fi

  bash "$HERE/board.sh" status "$num" Landed >/dev/null 2>&1
  gh issue comment "$num" --repo "$REPO" --body "Landed: PR #$pr squash-merged to main; branch deleted." >/dev/null 2>&1
  git -C "$REPOPATH" worktree remove --force "$wt" 2>/dev/null || true
  git -C "$REPOPATH" branch -D "$branch" 2>/dev/null || true
  echo "[land] #$num -> Landed (PR #$pr merged)"
done
