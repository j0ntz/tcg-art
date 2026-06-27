#!/usr/bin/env bash
# One orchestration tick. Wired to launchd (TICK_INTERVAL, default 30s).
# - Reserve guardrail: gh api rate_limit is FREE; if GraphQL budget is low, skip the
#   tick (fail-soft) so we never exhaust it and always leave headroom for transitions.
# - Fetch-once: read the board ONE time and share it with watchdog/watch/land via
#   ORCH_BOARD_SNAPSHOT, so a tick costs ~1 GraphQL read (~31 pts) regardless of stage.
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

# Order: tend sessions first, then advance the pipeline stage by stage. Every handler shares the
# one snapshot (free) and acts on at most one task per tick; each is idempotent via a session
# presence-guard, so re-running a tick never double-spawns.
bash "$HERE/watchdog.sh" || echo "[tick] watchdog errored (continuing)"
bash "$HERE/watch.sh"     || echo "[tick] watch errored (continuing)"   # Pending  -> run-task
bash "$HERE/test.sh"      || echo "[tick] test errored (continuing)"    # Coded    -> test-task
bash "$HERE/review.sh"    || echo "[tick] review errored (continuing)"  # Review   -> review-task
bash "$HERE/address.sh"   || echo "[tick] address errored (continuing)" # Address  -> address-task
bash "$HERE/land.sh"      || echo "[tick] land errored"                 # Land     -> land/land-task
