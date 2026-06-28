#!/usr/bin/env bash
# Watchdog for the tcg-art orchestration (v2). Tends every agent session so a crash/hang/finish
# never leaves the board wedged.
#
# Each "active" state has one expected agent session (the handler that owns it):
#   Running   -> claude-work-<n>    (work-task: build/write/ops + address)
#   Verifying -> claude-verify-<n>  (verify-code / verify-doc: independent check)
#   Landing   -> claude-land-<n>    (land-task: semantic-resolution merge)
# Rest/terminal states (Pending, Verified, Done) expect NO agent. `blocked` is a LABEL, not a
# state: a blocked task stays in its current state so you can see WHERE it stuck.
#
# Per item:
#   - Retire any agent session for the issue that is NOT the one its current state expects.
#   - Expected session alive + frozen (pane unchanged > FROZEN_MIN): kill it. If Running, also
#     flag `blocked` (a from-scratch work crash is worth surfacing); otherwise the idempotent
#     handler (verify/land) re-spawns next tick.
#   - Expected session dead while Running: work-task ended without routing out -> flag `blocked`.
#     (Verifying/Landing just re-spawn next tick.)
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

live_count=0
while IFS=$'\t' read -r num status; do
  [ -z "${num:-}" ] && continue

  case "$status" in
    Running)   exp="claude-work-$num" ;;
    Verifying) exp="claude-verify-$num" ;;
    Landing)   exp="claude-land-$num" ;;
    *)         exp="" ;;
  esac

  # Retire any agent session for this issue that is not the one its current state expects.
  for s in "claude-work-$num" "claude-verify-$num" "claude-land-$num"; do
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
        flag_blocked "$num" "agent appeared frozen (~${mins}m no output); killed and flagged blocked for review."
        echo "[watchdog] frozen #$num ($exp, ~${mins}m) -> killed + blocked"
      else
        echo "[watchdog] frozen #$num ($exp, ~${mins}m) -> killed; handler will re-spawn"
      fi
    fi
  else
    if [ "$status" = "Running" ]; then
      flag_blocked "$num" "work agent ended without finishing; flagged blocked for review (clear the label and re-queue to retry)."
      echo "[watchdog] dead session #$num ($exp) -> blocked"
    fi
    # Verifying/Landing with no session: the idempotent handler re-spawns next tick.
  fi
done <<< "$items"

if [ "$live_count" -gt "$FORK_WARN" ]; then
  echo "[watchdog] WARNING: $live_count live agent sessions > FORK_WARN=$FORK_WARN (possible fork storm)"
fi
echo "[watchdog] sweep done $(date '+%Y-%m-%d %H:%M:%S'); live=$live_count"
