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

# model_for <issue#> -> the CLI model string spawned agents for this issue start on ("" = no
# --model flag, i.e. the server-side default alias). Mirrors the Edge orch's agent_model:
#   1. The task's "Agent Model" board single-select, label mapped via agent.models{} in config.
#      Read from the tick snapshot (fetch-once), so the per-task lookup costs zero GraphQL.
#   2. agent.defaultModel from config.
# Best-effort: unset field / unknown label / read failure all fall through to the default.
model_for() {
  local sel model
  sel="$(board_items_json 2>/dev/null | NUM="$1" node -e '
    const num=process.env.NUM;
    const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
    const it=(d.items||[]).find(x=>x.content&&String(x.content.number)===String(num));
    if(!it)process.exit(0);
    const e=Object.entries(it).find(([k])=>/agent ?model/i.test(k));
    if(e&&typeof e[1]==="string")process.stdout.write(e[1]);
  ' 2>/dev/null || true)"
  model=""
  # Labels carry dots ("Opus 4.8"), so cfg()'s dot-path split cannot address them; look up direct.
  [ -n "$sel" ] && model="$(node -e 'const c=require(process.argv[1]);const m=((c.agent||{}).models||{})[process.argv[2]];process.stdout.write(m==null?"":String(m))' "$ORCH_CONFIG" "$sel" 2>/dev/null || true)"
  [ -z "$model" ] && model="$(cfg "agent.defaultModel")"
  printf '%s' "$model"
}

# effort_for <issue#> -> the reasoning-effort level the issue's agents start on ("" = no --effort
# flag). Same resolution as model_for; the option label IS the CLI value, accepted only from the
# known set (mirrors Edge's agent_effort).
effort_for() {
  local sel
  sel="$(board_items_json 2>/dev/null | NUM="$1" node -e '
    const num=process.env.NUM;
    const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
    const it=(d.items||[]).find(x=>x.content&&String(x.content.number)===String(num));
    if(!it)process.exit(0);
    const e=Object.entries(it).find(([k])=>/agent ?effort/i.test(k));
    if(e&&typeof e[1]==="string")process.stdout.write(e[1]);
  ' 2>/dev/null || true)"
  case "$sel" in low|medium|high|xhigh|max) printf '%s' "$sel"; return ;; esac
  sel="$(cfg "agent.defaultEffort")"
  case "$sel" in low|medium|high|xhigh|max) printf '%s' "$sel" ;; esac
}

# --- Sub-issue (parent/child) helpers. All REST, zero GraphQL. docs/orch-subtasks-design.md. ---

# sub_issues_json <issue#> -> the issue's children as a JSON array ("[]" if none or on failure).
# per_page=100 covers the platform max (100 children), so one page is always the whole list.
# gh api prints the error BODY to stdout on an HTTP error, so capture and discard on failure.
sub_issues_json() {
  local out
  out="$(gh api "repos/$REPO/issues/$1/sub_issues?per_page=100" 2>/dev/null)" || { echo '[]'; return; }
  printf '%s' "$out"
}

# parent_of <issue#> -> the parent issue number ("" if the issue has no parent; the endpoint 404s).
parent_of() {
  local out
  out="$(gh api "repos/$REPO/issues/$1/parent" --jq '.number' 2>/dev/null)" || return 0
  printf '%s' "$out"
}

# children_gate <issue#> -> "none" (not a parent) | "ready" (every child complete) |
# "waiting:<done>/<total>". A child is complete when its issue is CLOSED or its board status is
# Done (a no-PR research/ops child goes board-Done with its issue still open). Child issue states
# come from ONE REST call; board statuses from the tick snapshot when present. Deliberately never
# reads sub_issues_summary: it is eventually consistent and counts only closed children.
# Fails OPEN ("none" -> normal spawn): a premature parent spawn is caught by work-task's own
# gate re-check, which routes it back to Pending.
children_gate() {
  local subs
  subs="$(sub_issues_json "$1")"
  if [ -z "$subs" ] || [ "$subs" = "[]" ]; then echo none; return; fi
  board_items_json 2>/dev/null | SUBS="$subs" node -e '
    const subs=JSON.parse(process.env.SUBS||"[]");
    if(!subs.length){console.log("none");process.exit(0)}
    const board={};
    try{
      const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
      for(const it of d.items||[]){
        if(!it.content||!it.content.number)continue;
        const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));
        board[it.content.number]=e?e[1]:"";
      }
    }catch(e){}
    const done=subs.filter(s=>s.state==="closed"||board[s.number]==="Done").length;
    console.log(done===subs.length?"ready":("waiting:"+done+"/"+subs.length));
  ' 2>/dev/null || echo none
}

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

# remove_worktree <issue#> -> tear down the per-issue worktree dir ($WORKTREES/task-<n>) and prune
# its registration from the main checkout. Returns 0 if a worktree dir was present (and removed),
# 1 if there was nothing to remove. Only the local checkout is touched; the branch lives on origin
# and ensure_worktree re-provisions on demand, so this is safe once no agent is using the issue.
remove_worktree() {
  local num="$1" wt="$WORKTREES/task-$1/$REPO_NAME" repo="$HOME/git/$REPO_NAME"
  [ -d "$WORKTREES/task-$1" ] || return 1
  git -C "$repo" worktree remove --force "$wt" 2>/dev/null || true
  rm -rf "$WORKTREES/task-$1" 2>/dev/null || true
  git -C "$repo" worktree prune 2>/dev/null || true
  return 0
}

# spawn_agent <session> <worktree> <slash-cmd-with-arg>
# Starts a detached tmux session, cds into the worktree (so .claude/skills resolve), and launches
# the agent. Remote Control (viewable/controllable from claude.ai) is attached ONLY for the stages
# listed in agent.remoteControlStages: every RC spawn adds a session to the claude.ai list and
# fires one notification, so churny short-lived stages (verify/land) stay off it by default and
# are observed via their artifacts (PR review, issue run report, tick.log) or tmux attach.
# The session name is always claude-<stage>-<n>; the issue number resolves model/effort via
# model_for / effort_for. Model strings carry [1m] (a glob class), so the flag value stays
# double-quoted in the invocation.
spawn_agent() {
  local session="$1" wt="$2" cmd="$3"
  local num="${session##*-}" model effort model_flag="" effort_flag="" rc_flag=""
  local stage="${session#claude-}"; stage="${stage%%-*}"
  local rc_stages; rc_stages="$(cfg agent.remoteControlStages)"
  case ",$rc_stages," in *",$stage,"*) rc_flag="--remote-control \"$session\" " ;; esac
  model="$(model_for "$num")"
  [ -n "$model" ] && model_flag="--model \"$model\" "
  effort="$(effort_for "$num")"
  [ -n "$effort" ] && effort_flag="--effort $effort "
  if [ -n "${ORCH_DRY_RUN:-}" ]; then
    echo "[dry-run] would spawn $session (model='${model}' effort='${effort}') in $wt: $cmd"
    return 0
  fi
  tmux new-session -d -s "$session"
  tmux send-keys -t "$session" "cd \"$wt\" && claude ${model_flag}${effort_flag}${rc_flag}--dangerously-skip-permissions \"$cmd\"" C-m
}
