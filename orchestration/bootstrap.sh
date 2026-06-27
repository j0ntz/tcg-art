#!/usr/bin/env bash
# One-command bring-up of the tcg-art orchestration on a fresh Mac. Idempotent: safe to re-run.
#
#   git clone https://github.com/j0ntz/tcg-art.git ~/git/tcg-art
#   cd ~/git/tcg-art && orchestration/bootstrap.sh
#
# Steps: install deps -> ensure gh 'project' scope -> doctor (gate) -> arm cron -> verify a clean tick.
# Prerequisite NOT handled here (the spawned agents inherit it): the global Edge ~/.cursor conventions,
# brought up by cloning edge-dev-agents and running its ./bootstrap.sh. doctor.sh warns if it is absent.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
cd "$REPO_ROOT"

echo "== tcg-art bootstrap ($REPO_ROOT) =="

# 1. Dependencies (per-task worktrees symlink to this node_modules).
if [ ! -d node_modules ]; then
  echo "-- installing dependencies"
  if command -v sfw >/dev/null 2>&1; then sfw npm install; else npm install; fi
else
  echo "-- node_modules present (skipping install)"
fi

# 2. gh 'project' scope (tick loop reads/writes the board over the Projects GraphQL API).
if command -v gh >/dev/null 2>&1 && ! gh auth status 2>&1 | grep -qi "token scopes:.*project"; then
  echo "-- gh needs the 'project' scope; launching refresh (approve in your browser)"
  gh auth refresh -s project || { echo "!! gh auth refresh failed; run 'gh auth refresh -s project' manually" >&2; exit 1; }
fi

# 3. Preflight gate. Do not arm a cron that will only fail.
echo "-- preflight (doctor.sh)"
if ! bash "$HERE/doctor.sh"; then
  echo "!! doctor reported required failures above; fix them, then re-run bootstrap" >&2
  exit 1
fi

# 4. Arm the cron (install-watcher bakes HOME + PATH into the plist, so launchd's bare env is handled).
echo "-- arming cron"
bash "$HERE/install-watcher.sh" install

# 5. Verify a clean tick actually lands in the launchd context (not just that the plist loaded).
echo "-- verifying first clean tick (<=70s)"
log="$HOME/.config/tcg-orch/tick.log"
ok=0
for _ in $(seq 1 35); do
  if tail -8 "$log" 2>/dev/null | grep -q "no pending tasks\|nothing in"; then
    if tail -8 "$log" | grep -q "node: command not found\|board fetch failed"; then break; fi
    ok=1; break
  fi
  sleep 2
done
echo "--- latest tick ---"; tail -8 "$log" 2>/dev/null || echo "(no log yet)"
if [ "$ok" = 1 ]; then
  echo "== bootstrap complete. watch: tail -f $log | board: https://github.com/users/j0ntz/projects/1 =="
else
  echo "!! cron armed but no clean tick observed yet; check $log (PATH/HOME issues reinstall via install-watcher.sh)" >&2
  exit 1
fi
