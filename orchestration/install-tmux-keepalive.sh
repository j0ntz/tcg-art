#!/usr/bin/env bash
# Install/disarm the persistent tmux-server LaunchAgent (com.tcg-art.tmux). The orchestration
# cron attaches its agent sessions to this server so they outlive each tick. See
# tmux-keepalive.sh for the full why. install-watcher.sh install calls this first.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.tcg-art.tmux"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HOLDER="$HERE/tmux-keepalive.sh"
LOG="$HOME/.config/tcg-orch/tmux-keepalive.log"; mkdir -p "$(dirname "$LOG")"

# launchd hands the job a bare PATH; bake in wherever this machine keeps tmux + node so the
# holder (and the agents spawned into its server) can resolve their tools. Portable across
# homebrew/nvm/asdf layouts.
TMUX_DIR="$(cd "$(dirname "$(command -v tmux)")" && pwd -P)"
NODE_DIR="$(cd "$(dirname "$(command -v node)")" && pwd -P)"
KA_PATH="$TMUX_DIR:$NODE_DIR:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

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
    <string>$HOLDER</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>$HOME</string>
    <key>PATH</key><string>$KA_PATH</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "armed $LABEL (persistent tmux server holds the orch agents' sessions across ticks)"
    ;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    tmux kill-session -t __orch_keepalive__ 2>/dev/null || true
    echo "disarmed $LABEL"
    ;;
  status)
    launchctl list | grep -q "$LABEL" && echo "agent: armed" || echo "agent: not armed"
    tmux has-session -t __orch_keepalive__ 2>/dev/null && echo "keepalive session: alive" || echo "keepalive session: MISSING"
    ;;
  *) echo "usage: install-tmux-keepalive.sh {install|uninstall|status}"; exit 2 ;;
esac
