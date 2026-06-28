#!/usr/bin/env bash
# One orchestration tick (v2). Wired to launchd (TICK_INTERVAL, default 60s).
# - Rate-limit guardrail: gh api rate_limit is FREE; skip the tick if GraphQL budget is low,
#   so we never exhaust it and always leave headroom for transitions.
# - Fetch-once: read the board ONCE and share it with handlers via ORCH_BOARD_SNAPSHOT, so a
#   tick costs ~1 GraphQL read regardless of how many stages act.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

echo "===== tick $(date '+%F %T') ====="

RESERVE="${GRAPHQL_RESERVE:-800}"
rem="$(gh api rate_limit --jq '.resources.graphql.remaining' 2>/dev/null || echo 0)"
if [ "${rem:-0}" -lt "$RESERVE" ]; then
  reset_in=$(( ( $(gh api rate_limit --jq '.resources.graphql.reset' 2>/dev/null || echo 0) - $(date +%s) ) / 60 ))
  echo "[tick] throttled: graphql remaining=$rem < reserve=$RESERVE (resets ~${reset_in}m); skipping"
  exit 0
fi

SNAP="$(mktemp -t tcg-board.XXXXXX)"
trap 'rm -f "$SNAP"' EXIT
if gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200 > "$SNAP" 2>/dev/null && [ -s "$SNAP" ]; then
  export ORCH_BOARD_SNAPSHOT="$SNAP"
else
  echo "[tick] board fetch failed/empty; skipping"; exit 0
fi

# Tend sessions, then advance the pipeline stage by stage. Each handler shares the one snapshot
# (free), acts on at most one task per tick, is idempotent via a tmux presence-guard, and skips
# any task carrying the `blocked` label.
bash "$HERE/watchdog.sh" || echo "[tick] watchdog errored (continuing)"
bash "$HERE/watch.sh"    || echo "[tick] watch errored (continuing)"    # Pending   -> work-task
bash "$HERE/verify.sh"   || echo "[tick] verify errored (continuing)"   # Verifying -> verify-{code,doc}
bash "$HERE/land.sh"     || echo "[tick] land errored"                  # Landing   -> land-task
