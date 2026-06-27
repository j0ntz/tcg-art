#!/usr/bin/env bash
# One orchestration tick: tend live sessions, then pick up new Pending work.
# Wired to launchd (~every 120s via install-watcher.sh). Idempotent + safe to run repeatedly.
HERE="$(cd "$(dirname "$0")" && pwd)"
echo "===== tick $(date '+%Y-%m-%d %H:%M:%S') ====="
bash "$HERE/watchdog.sh" || echo "[tick] watchdog errored (continuing)"
bash "$HERE/watch.sh"     || echo "[tick] watch errored (continuing)"
bash "$HERE/land.sh"      || echo "[tick] land errored"
