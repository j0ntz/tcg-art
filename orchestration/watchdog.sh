#!/usr/bin/env bash
# Watchdog for the tcg-art orchestration (v2). Tends every agent session AND per-task worktree so a
# crash/hang/finish never leaves the board wedged or leaks resources.
#
# Each "active" (gerund) state has one expected agent session (the handler that owns it):
#   Running   -> claude-work-<n>    (work-task: build/write/ops + address)
#   Verifying -> claude-verify-<n>  (verify-code / verify-doc: independent check)
#   Landing   -> claude-land-<n>    (land-task: semantic-resolution merge)
# Rest/terminal states (Pending, Verified, Done) expect NO agent. `blocked` is a LABEL, not a
# state: a blocked task stays in its current state so you can see WHERE it stuck.
#
# Each sweep, in order:
#   1. REAP SESSIONS: kill every live claude-{work,verify,land}-* session that is not the one some
#      board item currently expects. This is a global sweep over the tmux server, so it covers a
#      superseded stage session, a Done task's leftover session, AND a session whose issue has been
#      removed from the board entirely (the off-board orphan the old per-item loop missed).
#   2. FROZEN/DEAD WATCH: for each gerund item, kill its expected session if frozen; a Running
#      crash/dead session also flags `blocked`. Verifying/Landing just re-spawn next tick.
#   3. GC WORKTREES: delete the per-issue worktree once the task is Done or off the board. No agent
#      can be using it then; the branch lives on origin and ensure_worktree re-provisions on demand.
# Passes 1 and 3 run ONLY when the board read returned items, so a transient board-fetch failure
# (empty read) never mass-reaps live sessions/worktrees.
# NOT set -e: one failing check must never abort the whole sweep.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

STATE_DIR="$HOME/.config/tcg-orch"; mkdir -p "$STATE_DIR"
STATE="$STATE_DIR/watchdog-state.json"
FROZEN_MIN="${TCG_FROZEN_MIN:-15}"
FORK_WARN="${TCG_FORK_WARN:-6}"
now="$(date +%s)"

items="$(board_items_json 2>/dev/null \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));for(const it of d.items||[]){if(!it.content||!it.content.number)continue;const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));console.log(it.content.number+"\t"+(e?e[1]:""))}' 2>/dev/null || true)"

# exp_session <status> <issue#> -> the one session that status expects ("" for non-gerund states).
exp_session() {
  case "$1" in
    Running)   echo "claude-work-$2" ;;
    Verifying) echo "claude-verify-$2" ;;
    Landing)   echo "claude-land-$2" ;;
  esac
}

# blocked is a label on the current state, so the human sees where it stuck. IDEMPOTENT:
# a task only gets flagged + commented ONCE; while it stays blocked the watchdog leaves it
# alone (it is awaiting human action), so we never re-comment tick after tick.
flag_blocked() {
  has_label "$1" blocked && return 0
  add_label "$1" blocked >/dev/null 2>&1
  gh issue comment "$1" --repo "$REPO" --body "Watchdog: $2" >/dev/null 2>&1
}

# is the expected session frozen? echoes "frozen:<mins>" or "ok" and updates the state file.
frozen_verdict() {
  local session="$1"
  local pane; pane="$(tmux capture-pane -t "$session" -p -S -40 2>/dev/null | shasum | awk '{print $1}')"
  node -e '
    const fs=require("fs");const [stateFile,key,hash,now,frozenMin]=process.argv.slice(1);
    let s={};try{s=JSON.parse(fs.readFileSync(stateFile,"utf8"))}catch(e){}
    const prev=s[key];const t=Number(now);
    if(!prev||prev.hash!==hash){s[key]={hash,ts:t};fs.writeFileSync(stateFile,JSON.stringify(s));process.stdout.write("ok")}
    else{const mins=(t-prev.ts)/60;process.stdout.write(mins>=Number(frozenMin)?("frozen:"+Math.round(mins)):"ok")}
  ' "$STATE" "$session" "$pane" "$now" "$FROZEN_MIN" 2>/dev/null || echo ok
}

# Set of currently-expected sessions (one per gerund item), newline-delimited.
expected="$(while IFS=$'\t' read -r num status; do
  [ -z "${num:-}" ] && continue
  exp_session "$status" "$num"
done <<< "$items")"

# --- Pass 1: reap every orch agent session no board item expects (superseded / Done / off-board) ---
if [ -n "$items" ]; then
  while read -r s; do
    [ -z "$s" ] && continue
    if ! grep -qxF "$s" <<< "$expected"; then
      tmux kill-session -t "$s" 2>/dev/null && echo "[watchdog] reaped session $s (no board item expects it)"
    fi
  done < <(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -E '^claude-(work|verify|land)-[0-9]+$')
fi

# --- Pass 2: frozen/dead watch on each gerund item's expected session ---
live_count=0
while IFS=$'\t' read -r num status; do
  [ -z "${num:-}" ] && continue
  exp="$(exp_session "$status" "$num")"
  [ -z "$exp" ] && continue

  if tmux has-session -t "$exp" 2>/dev/null; then
    live_count=$((live_count+1))
    verdict="$(frozen_verdict "$exp")"
    if [[ "$verdict" == frozen:* ]]; then
      mins="${verdict#frozen:}"
      tmux kill-session -t "$exp" 2>/dev/null
      if [ "$status" = "Running" ]; then
        flag_blocked "$num" "agent appeared frozen (~${mins}m no output); killed and flagged blocked for review."
        echo "[watchdog] frozen #$num ($exp, ~${mins}m) -> killed + blocked"
      else
        echo "[watchdog] frozen #$num ($exp, ~${mins}m) -> killed; handler will re-spawn"
      fi
    fi
  else
    # Already-blocked tasks are awaiting the human: skip silently instead of re-logging each tick.
    if [ "$status" = "Running" ] && ! has_label "$num" blocked; then
      flag_blocked "$num" "work agent ended without finishing; flagged blocked for review (clear the label and re-queue to retry)."
      echo "[watchdog] dead session #$num ($exp) -> blocked"
    fi
    # Verifying/Landing with no session: the idempotent handler re-spawns next tick.
  fi
done <<< "$items"

# --- Pass 3: GC per-issue worktrees for Done / off-board tasks ---
# Gerund states keep their worktree (an agent may be mid-run). Pending/Verified keep theirs too
# (re-provisioned on pickup/land if missing). Only Done or absent-from-board frees the disk.
if [ -n "$items" ] && [ -d "$WORKTREES" ]; then
  for d in "$WORKTREES"/task-*/; do
    [ -d "$d" ] || continue
    n="$(basename "$d")"; n="${n#task-}"
    case "$n" in ''|*[!0-9]*) continue ;; esac
    st="$(printf '%s\n' "$items" | awk -F'\t' -v n="$n" '$1==n{print $2}')"
    if [ -z "$st" ] || [ "$st" = "Done" ]; then
      remove_worktree "$n" && echo "[watchdog] GC worktree task-$n (status=${st:-off-board})"
    fi
  done
fi

if [ "$live_count" -gt "$FORK_WARN" ]; then
  echo "[watchdog] WARNING: $live_count live agent sessions > FORK_WARN=$FORK_WARN (possible fork storm)"
fi
echo "[watchdog] sweep done $(date '+%Y-%m-%d %H:%M:%S'); live=$live_count"
