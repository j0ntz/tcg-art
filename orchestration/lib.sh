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
