#!/usr/bin/env bash
# Watchdog for the tcg-art orchestration. Run on a schedule (launchd) alongside the watcher.
# Tends live agent sessions so a crash/hang/finish never leaves the board wedged:
#   - Completion sweep : board item Done   -> kill (retire) its session, free the slot.
#   - Dead-session     : board item Running with NO live session (agent crashed/exited) -> Blocked + comment.
#   - Frozen sweep     : session alive but pane output unchanged > FROZEN_MIN -> kill + Blocked (covers
#                        the known --dangerously-skip-permissions detached-freeze).
#   - Fork-storm guard : warn if live agent sessions exceed MAX.
# NOT set -e: one failing check must never abort the whole sweep.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

STATE_DIR="$HOME/.config/tcg-orch"; mkdir -p "$STATE_DIR"
STATE="$STATE_DIR/watchdog-state.json"
FROZEN_MIN="${TCG_FROZEN_MIN:-15}"
now="$(date +%s)"

items="$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200 2>/dev/null \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));for(const it of d.items||[]){if(!it.content||!it.content.number)continue;const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));console.log(it.content.number+"\t"+(e?e[1]:""))}' 2>/dev/null || true)"

live_count=0
while IFS=$'\t' read -r num status; do
  [ -z "${num:-}" ] && continue
  session="claude-task-$num"
  if tmux has-session -t "$session" 2>/dev/null; then alive=1; live_count=$((live_count+1)); else alive=0; fi

  case "$status" in
    Done)
      if [ "$alive" = 1 ]; then
        tmux kill-session -t "$session" 2>/dev/null && echo "[watchdog] retired $session (Done)"
      fi
      ;;
    Running)
      if [ "$alive" = 0 ]; then
        bash "$HERE/board.sh" status "$num" Blocked >/dev/null 2>&1
        gh issue comment "$num" --repo "$REPO" --body "Watchdog: agent session ended without finishing; marked Blocked for review." >/dev/null 2>&1
        echo "[watchdog] dead session #$num -> Blocked"
      else
        pane="$(tmux capture-pane -t "$session" -p -S -40 2>/dev/null | shasum | awk '{print $1}')"
        verdict="$(node -e '
          const fs=require("fs");const [stateFile,key,hash,now,frozenMin]=process.argv.slice(1);
          let s={};try{s=JSON.parse(fs.readFileSync(stateFile,"utf8"))}catch(e){}
          const prev=s[key];const t=Number(now);
          if(!prev||prev.hash!==hash){s[key]={hash,ts:t};fs.writeFileSync(stateFile,JSON.stringify(s));process.stdout.write("ok")}
          else{const mins=(t-prev.ts)/60;process.stdout.write(mins>=Number(frozenMin)?("frozen:"+Math.round(mins)):"ok")}
        ' "$STATE" "$session" "$pane" "$now" "$FROZEN_MIN" 2>/dev/null || echo ok)"
        if [[ "$verdict" == frozen:* ]]; then
          mins="${verdict#frozen:}"
          tmux kill-session -t "$session" 2>/dev/null
          bash "$HERE/board.sh" status "$num" Blocked >/dev/null 2>&1
          gh issue comment "$num" --repo "$REPO" --body "Watchdog: agent appeared frozen (~${mins}m no output); killed and marked Blocked for review." >/dev/null 2>&1
          echo "[watchdog] frozen #$num (~${mins}m no output) -> killed + Blocked"
        fi
      fi
      ;;
  esac
done <<< "$items"

if [ "$live_count" -gt "$MAX" ]; then
  echo "[watchdog] WARNING: $live_count live agent sessions > MAX=$MAX (possible fork storm)"
fi
echo "[watchdog] sweep done $(date '+%Y-%m-%d %H:%M:%S'); live=$live_count"
