#!/usr/bin/env bash
# Shared config loader for the tcg-art orchestration.
# Single source of truth = orch.config.json. Sourced by board.sh, watch.sh, watchdog.sh.
# Switching the Vercel account/scope/project, the board, or the repo = edit orch.config.json only.

# Ensure tools resolve under launchd/cron's minimal PATH (node, gh, tmux, git, shasum, claude).
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

ORCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ORCH_CONFIG="${ORCH_CONFIG:-$ORCH_DIR/orch.config.json}"

# cfg <dot.path> -> value ("" if missing)
cfg() {
  node -e 'const c=require(process.argv[1]);const v=process.argv[2].split(".").reduce((o,k)=>(o==null?o:o[k]),c);process.stdout.write(v==null?"":String(v))' "$ORCH_CONFIG" "$1"
}

OWNER="$(cfg board.owner)"
PROJECT_NUMBER="$(cfg board.projectNumber)"
PROJECT_ID="$(cfg board.projectId)"
FIELD_ID="$(cfg board.statusFieldId)"
REPO="$(cfg github.owner)/$(cfg github.repo)"
REPO_NAME="$(cfg github.repo)"
WORKTREES="$(cfg worktreesRoot)"; WORKTREES="${WORKTREES/#\~/$HOME}"
MAX="${AGENT_MAX_CONCURRENT:-$(cfg maxConcurrent)}"
MERGE_METHOD="$(cfg land.mergeMethod)"; [ -z "$MERGE_METHOD" ] && MERGE_METHOD="squash"

# opt_id <Pending|Running|Blocked|Done|Land|Landed> -> option id
opt_id() { cfg "board.statusOptions.$1"; }

# Board items JSON. If a tick exported ORCH_BOARD_SNAPSHOT (fetch-once), reuse it (free);
# otherwise fetch fresh (1 GraphQL read) for standalone runs.
board_items_json() {
  if [ -n "${ORCH_BOARD_SNAPSHOT:-}" ] && [ -s "${ORCH_BOARD_SNAPSHOT:-/nonexistent}" ]; then
    cat "$ORCH_BOARD_SNAPSHOT"
  else
    gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200
  fi
}

# Issue label helpers (REST, cheap). Labels are TAGS here (blocked, auto-review, in-review), NOT state.
has_label()    { gh issue view "$1" --repo "$REPO" --json labels -q '.labels[].name' 2>/dev/null | grep -qx "$2"; }
add_label()    { gh issue edit "$1" --repo "$REPO" --add-label "$2"    >/dev/null 2>&1 || true; }
remove_label() { gh issue edit "$1" --repo "$REPO" --remove-label "$2" >/dev/null 2>&1 || true; }

# pr_head_sha <issue#> -> the PR's head commit (for idempotency checks); empty if no open PR.
pr_head_sha() { gh pr list --repo "$REPO" --head "jon/task-$1" --state open --json headRefOid -q '.[0].headRefOid' 2>/dev/null || true; }

# first_item_in_state <Status> -> issue number of the first board item in that state ("" if none).
# Shared by the pipeline handlers (test/review/address/land) to find their one task per tick.
first_item_in_state() {
  board_items_json 2>/dev/null | STATUS="$1" node -e '
    const want=process.env.STATUS;
    const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
    for(const it of d.items||[]){
      if(!it.content||!it.content.number)continue;
      const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));
      if((e?e[1]:"")===want){console.log(it.content.number);break}
    }' 2>/dev/null || true
}

# ensure_worktree <issue#> -> provisions $WORKTREES/task-<n>/$REPO_NAME on branch jon/task-<n>,
# synced hard to origin/<branch>. Echoes the path on success; returns non-zero if it cannot.
# Only ever called when no agent session for the issue is live (the handler's presence-guard),
# so the hard reset never clobbers in-flight work.
ensure_worktree() {
  local num="$1" branch="jon/task-$1" wt="$WORKTREES/task-$1/$REPO_NAME" repo="$HOME/git/$REPO_NAME"
  git -C "$repo" fetch -q origin 2>/dev/null || true
  if [ -d "$wt" ]; then
    git -C "$wt" fetch -q origin 2>/dev/null || true
    git -C "$wt" checkout -q "$branch" 2>/dev/null || true
    git -C "$wt" reset -q --hard "origin/$branch" 2>/dev/null || true
  else
    mkdir -p "$(dirname "$wt")"
    git -C "$repo" worktree add "$wt" "$branch" 2>/dev/null \
      || git -C "$repo" worktree add --force -B "$branch" "$wt" "origin/$branch" 2>/dev/null \
      || return 1
    [ -e "$wt/node_modules" ] || ln -s "$repo/node_modules" "$wt/node_modules" 2>/dev/null || true
  fi
  printf '%s' "$wt"
}

# spawn_agent <session> <worktree> <slash-cmd-with-arg>
# Starts a detached tmux session, cds into the worktree (so .claude/skills resolve), launches the agent.
spawn_agent() {
  local session="$1" wt="$2" cmd="$3"
  tmux new-session -d -s "$session"
  tmux send-keys -t "$session" "cd \"$wt\" && claude --dangerously-skip-permissions \"$cmd\"" C-m
}
