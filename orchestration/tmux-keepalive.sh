#!/usr/bin/env bash
# Persistent tmux server holder for the tcg-art orchestration.
#
# WHY: the cron (com.tcg-art.orch) spawns each agent with `tmux new-session` from inside a
# per-tick launchd invocation. When that tick exits (~5s later), launchd tears down the job's
# context and reaps the tmux server it started, killing live agents ~1 tick (~60s) in. Proven
# empirically: an off-cron (login-context) spawn of the same agent ran 17 min, while cron-spawned
# ones died at ~60s. AbandonProcessGroup on the cron plist did NOT prevent it (the server
# daemonizes out of the job's PGID but is still reaped with the job's launchd context).
#
# FIX: keep ONE tmux server alive in a context that never exits. This script runs as a KeepAlive
# LaunchAgent (com.tcg-art.tmux); while it loops, launchd holds its context (and the server)
# alive. The cron's `tmux new-session` then attaches to THIS already-running server, so agent
# sessions are children of the persistent server (not the dying tick) and survive.
set -u
SESSION="__orch_keepalive__"
while true; do
  tmux has-session -t "$SESSION" 2>/dev/null || tmux new-session -d -s "$SESSION" 'while true; do sleep 86400; done'
  sleep 30
done
