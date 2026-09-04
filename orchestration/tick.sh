#!/usr/bin/env bash
# One orchestration tick (v2). Wired to launchd (TICK_INTERVAL, default 60s).
# - Rate-limit guardrail: the GraphQL `rateLimit` object (cost 1) is the per-user pool the
#   limit is enforced against. The REST `gh api rate_limit` graphql counter is NOT: it reads
#   0 used while the pool is exhausted, so a reserve checked there only trips after the pool
#   is already gone (2026-09-04: 750 ticks/day at 101 points each starved every other gh
#   consumer on the box, and the reserve fired 7 times, all post-exhaustion).
# - Delta probe before the fetch: `gh project item-list --limit 200` costs ~100 points per
#   call (every field value of every item). A 1-point probe (project updatedAt, item count,
#   newest item updatedAt) fingerprints the board; the full fetch runs only when the
#   fingerprint moved or the cached snapshot is older than BOARD_MAX_AGE. An idle board
#   costs ~60 points/hour instead of ~6,000.
# - Fetch-once: the (fresh or cached) snapshot is shared with handlers via ORCH_BOARD_SNAPSHOT,
#   so a tick costs one board read at most regardless of how many stages act.
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

echo "===== tick $(date '+%F %T') ====="

RESERVE="${GRAPHQL_RESERVE:-800}"
RL="$(gh api graphql -f query='{ rateLimit { remaining resetAt } }' --jq '.data.rateLimit | "\(.remaining) \(.resetAt)"' 2>/dev/null || echo "0 unknown")"
rem="${RL%% *}"; reset_at="${RL#* }"
if [ "${rem:-0}" -lt "$RESERVE" ]; then
  echo "[tick] throttled: graphql remaining=$rem < reserve=$RESERVE (resets $reset_at); skipping"
  exit 0
fi

# Board snapshot: cached unless the fingerprint moved or the cache aged out.
STATE_DIR="${ORCH_STATE_DIR:-$HOME/.config/tcg-orch}"; mkdir -p "$STATE_DIR"
CACHE="$STATE_DIR/board.json"; FP_FILE="$STATE_DIR/board.fingerprint"
BOARD_MAX_AGE="${BOARD_MAX_AGE:-900}"
fp="$(gh api graphql -f query="{ user(login:\"$OWNER\"){ projectV2(number:$PROJECT_NUMBER){ updatedAt items(first:100){ totalCount nodes{ updatedAt } } } } }" \
  --jq '.data.user.projectV2 | "\(.updatedAt)|\(.items.totalCount)|\([.items.nodes[].updatedAt]|max)"' 2>/dev/null || true)"
cache_age=$(( $(date +%s) - $(stat -f %m "$CACHE" 2>/dev/null || echo 0) ))
if [ -n "$fp" ] && [ -s "$CACHE" ] && [ "$fp" = "$(cat "$FP_FILE" 2>/dev/null)" ] && [ "$cache_age" -lt "$BOARD_MAX_AGE" ]; then
  echo "[tick] board: cached (fingerprint unchanged, age ${cache_age}s)"
else
  TMP="$(mktemp -t tcg-board.XXXXXX)"
  if gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200 > "$TMP" 2>/dev/null && [ -s "$TMP" ]; then
    mv "$TMP" "$CACHE"; printf '%s' "$fp" > "$FP_FILE"
    echo "[tick] board: fetched (fingerprint ${fp:-unavailable})"
  else
    rm -f "$TMP"; echo "[tick] board fetch failed/empty; skipping"; exit 0
  fi
fi
export ORCH_BOARD_SNAPSHOT="$CACHE"

# Tend sessions, then advance the pipeline stage by stage. Each handler shares the one snapshot
# (free), acts on at most one task per tick, is idempotent via a tmux presence-guard, and skips
# any task carrying the `blocked` label.
bash "$HERE/watchdog.sh" || echo "[tick] watchdog errored (continuing)"
bash "$HERE/watch.sh"    || echo "[tick] watch errored (continuing)"    # Pending   -> work-task
bash "$HERE/verify.sh"   || echo "[tick] verify errored (continuing)"   # Verifying -> verify-{code,doc}
bash "$HERE/land.sh"     || echo "[tick] land errored"                  # Landing   -> land-task
