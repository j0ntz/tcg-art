#!/usr/bin/env bash
# Arm/disarm the orchestration tick as a launchd LaunchAgent (the "cron").
#   install-watcher.sh install    -> write plist + load; ticks every TICK_INTERVAL s (default 120)
#   install-watcher.sh uninstall  -> unload + remove plist (STOP the orchestration)
#   install-watcher.sh status     -> show launchd state + tail the tick log
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.tcg-art.orch"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
TICK="$HERE/tick.sh"
LOGDIR="$HOME/.config/tcg-orch"; mkdir -p "$LOGDIR"
LOG="$LOGDIR/tick.log"
INTERVAL="${TICK_INTERVAL:-60}"   # 60s: fetch-once = 1 board read (~31 GraphQL pts) per tick ~= 37% of the 5000/hr budget; neighborly on the account-wide budget, and the tick's rate_limit reserve guardrail still auto-throttles before exhaustion

# launchd gives the job a bare environment (no HOME, PATH=/usr/bin:/bin:/usr/sbin:/sbin), so
# lib.sh's $HOME-relative paths, node, gh, git, and tmux are all unresolvable under the cron.
# Capture a working HOME + PATH at install time and bake them into the plist. NODE_DIR is
# wherever this machine installed node (nvm, homebrew, asdf, ...), so this is portable.
NODE_DIR="$(cd "$(dirname "$(command -v node)")" && pwd -P)"
CRON_PATH="$NODE_DIR:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

case "${1:-}" in
  install)
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$TICK</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>$HOME</string>
    <key>PATH</key><string>$CRON_PATH</string>
  </dict>
  <key>StartInterval</key><integer>$INTERVAL</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
EOF
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "armed $LABEL: tick every ${INTERVAL}s"
    echo "log:  $LOG"
    echo "stop: $0 uninstall"
    ;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "disarmed $LABEL (removed $PLIST)"
    ;;
  status)
    if launchctl list | grep -q "$LABEL"; then
      echo "armed:"; launchctl list | grep "$LABEL"
    else
      echo "not armed"
    fi
    echo "--- last tick log ---"; tail -25 "$LOG" 2>/dev/null || echo "(no log yet)"
    ;;
  *)
    echo "usage: install-watcher.sh {install|uninstall|status}"; exit 2 ;;
esac
