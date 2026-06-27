#!/usr/bin/env bash
# Watchdog for the tcg-art orchestration. Run on a schedule (launchd) alongside the watcher.
# Tends EVERY pipeline agent session so a crash/hang/finish never leaves the board wedged.
#
# Each "active" state has one expected agent session (the handler that owns that state):
#   Running -> claude-task-<n>     (run-task: code + PR)
#   Coded   -> claude-test-<n>     (test-task: verify preview + run report)
#   Review  -> claude-review-<n>   (review-task: independent PR review)
#   Address -> claude-address-<n>  (address-task: address review + re-enter)
#   Land    -> claude-land-<n>     (land-task: semantic-resolution merge)
# Waiting/terminal states (Pending, Testing, Reviewed, Landed, Blocked) expect NO agent.
#
# Per item:
#   - Retire any agent session for the issue that is NOT the expected one (finished / stale).
#   - Expected session alive + frozen (pane unchanged > FROZEN_MIN): kill it. If the state is
#     Running, also -> Blocked (a from-scratch coding crash is a real problem to surface);
#     otherwise just kill and let the idempotent handler re-spawn next tick.
#   - Expected session dead while state == Running: run-task crashed -> Blocked + comment.
#     (For Coded/Review/Address/Land the handler simply re-spawns next tick; no Blocked.)
#   - Fork-storm guard: warn if total live agent sessions exceed FORK_WARN.
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

block() {
  bash "$HERE/board.sh" status "$1" Blocked >/dev/null 2>&1
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

live_count=0
while IFS=$'\t' read -r num status; do
  [ -z "${num:-}" ] && continue

  case "$status" in
    Running) exp="claude-task-$num" ;;
    Coded)   exp="claude-test-$num" ;;
    Review)  exp="claude-review-$num" ;;
    Address) exp="claude-address-$num" ;;
    Land)    exp="claude-land-$num" ;;
    *)       exp="" ;;
  esac

  # Retire any agent session for this issue that is not the one its current state expects.
  for s in "claude-task-$num" "claude-test-$num" "claude-review-$num" "claude-address-$num" "claude-land-$num"; do
    [ "$s" = "$exp" ] && continue
    if tmux has-session -t "$s" 2>/dev/null; then
      tmux kill-session -t "$s" 2>/dev/null && echo "[watchdog] retired stale $s (state=$status)"
    fi
  done

  [ -z "$exp" ] && continue

  if tmux has-session -t "$exp" 2>/dev/null; then
    live_count=$((live_count+1))
    verdict="$(frozen_verdict "$exp")"
    if [[ "$verdict" == frozen:* ]]; then
      mins="${verdict#frozen:}"
      tmux kill-session -t "$exp" 2>/dev/null
      if [ "$status" = "Running" ]; then
        block "$num" "agent appeared frozen (~${mins}m no output); killed and marked Blocked for review."
        echo "[watchdog] frozen #$num ($exp, ~${mins}m) -> killed + Blocked"
      else
        echo "[watchdog] frozen #$num ($exp, ~${mins}m) -> killed; handler will re-spawn"
      fi
    fi
  else
    if [ "$status" = "Running" ]; then
      block "$num" "agent session ended without finishing; marked Blocked for review."
      echo "[watchdog] dead session #$num ($exp) -> Blocked"
    fi
    # Coded/Review/Address/Land with no session: the idempotent handler re-spawns next tick.
  fi
done <<< "$items"

if [ "$live_count" -gt "$FORK_WARN" ]; then
  echo "[watchdog] WARNING: $live_count live agent sessions > FORK_WARN=$FORK_WARN (possible fork storm)"
fi
echo "[watchdog] sweep done $(date '+%Y-%m-%d %H:%M:%S'); live=$live_count"
