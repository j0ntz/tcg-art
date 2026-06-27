#!/usr/bin/env bash
# Preflight for the tcg-art orchestration. Verifies every prerequisite a machine needs
# before the cron can run, and prints the exact fix for anything missing. Exits non-zero
# if any REQUIRED check fails (bootstrap.sh gates on this). Read-only. Run:
#   orchestration/doctor.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"

fail=0; warn=0
pass(){ printf "  \033[32mPASS\033[0m  %s\n" "$1"; }
bad(){  printf "  \033[31mFAIL\033[0m  %s\n        fix: %s\n" "$1" "$2"; fail=$((fail+1)); }
note(){ printf "  \033[33mWARN\033[0m  %s\n        %s\n" "$1" "$2"; warn=$((warn+1)); }

echo "== tcg-art orchestration doctor =="

# 1. Tooling on PATH (claude spawns the agents; node drives lib.sh; gh/git/tmux/jq are the plumbing)
for t in git gh node npm tmux jq shasum claude; do
  if command -v "$t" >/dev/null 2>&1; then pass "tool: $t -> $(command -v "$t")"
  else bad "tool missing: $t" "install $t and put it on PATH"; fi
done

# 2. Chrome (verify-preview / screenshot-mobile drive it headlessly over CDP in the Testing phase)
if [ -d "/Applications/Google Chrome.app" ]; then pass "Google Chrome present"
else bad "Google Chrome not found" "install Google Chrome"; fi

# 3. gh auth + the project scope the tick loop reads/writes the board with
if gh auth status >/dev/null 2>&1; then
  if gh auth status 2>&1 | grep -qi "token scopes:.*project"; then pass "gh authenticated with 'project' scope"
  else bad "gh token missing 'project' scope" "gh auth refresh -s project"; fi
else bad "gh not authenticated" "gh auth login"; fi

# 4. node_modules (per-task worktrees symlink to this; builds fail without it)
if [ -d "$REPO_ROOT/node_modules" ]; then pass "node_modules present"
else bad "node_modules missing" "cd $REPO_ROOT && (sfw npm install || npm install)"; fi

# 5. Global Edge conventions the spawned agents inherit (external prerequisite, lives in edge-dev-agents)
if [ -f "$HOME/.claude/CLAUDE.md" ]; then pass "global ~/.claude/CLAUDE.md present"
else note "global ~/.claude/CLAUDE.md absent" "spawned agents inherit it; bring up edge-dev-agents (clone + ./bootstrap.sh)"; fi
if command -v sfw >/dev/null 2>&1; then pass "sfw npm wrapper present"
else note "sfw npm wrapper absent" "only needed if this machine blocks bare npm; comes from the edge-dev-agents setup"; fi

# 6. Board reachable (needs node + project scope; only source lib.sh once node is confirmed).
# Guard on the GraphQL budget first (the rate_limit endpoint is FREE) so a rate-limited read
# is reported as transient throttling, not a false "check your config" failure.
if command -v node >/dev/null 2>&1 && gh auth status 2>&1 | grep -qi "token scopes:.*project"; then
  # shellcheck disable=SC1091
  source "$HERE/lib.sh"
  rem="$(gh api rate_limit --jq '.resources.graphql.remaining' 2>/dev/null || echo 0)"
  if [ "${rem:-0}" -lt 50 ]; then
    note "GraphQL budget low (remaining=$rem), board read skipped" "transient; the tick guardrail also backs off below ${GRAPHQL_RESERVE:-800}. retry after the hourly reset"
  elif gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 1 >/dev/null 2>&1; then
    pass "board reachable (project #$PROJECT_NUMBER, owner $OWNER, repo $REPO)"
  else bad "cannot read board #$PROJECT_NUMBER" "check board.owner / board.projectNumber in orch.config.json"; fi
fi

# 7. Cron health (armed + recent ticks not failing on the classic PATH/HOME issue).
# Use `launchctl list <label>` (single command, exit 0 iff loaded) so `set -o pipefail` does
# not turn a non-zero exit from a bare `launchctl list` into a false "not armed".
if launchctl list com.tcg-art.orch >/dev/null 2>&1; then
  pass "launchd cron com.tcg-art.orch loaded"
  log="$HOME/.config/tcg-orch/tick.log"
  if [ -f "$log" ] && tail -20 "$log" | grep -q "===== tick"; then
    if tail -20 "$log" | grep -q "node: command not found\|board fetch failed"; then
      bad "recent ticks are failing" "almost always a launchd PATH/HOME gap; reinstall: orchestration/install-watcher.sh install"
    else pass "recent ticks look clean"; fi
  else note "no tick log yet" "the first tick writes $log within 60s of arming"; fi
else note "cron not armed" "orchestration/install-watcher.sh install"; fi

# 8. No drift vs git. The cron runs orchestration/*.sh from THIS checkout, so it must match
# git. Uncommitted/untracked changes, or a checkout that has diverged from origin, mean the
# running orch differs from what is on git (and from what a fresh machine would clone). The
# per-task worktrees self-heal via reset-to-origin; the main checkout has no such guard.
if [ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)" ]; then
  bad "checkout has uncommitted/untracked changes (running orch may differ from git)" "cd $REPO_ROOT && git status; commit or restore"
else
  pass "checkout clean (no uncommitted/untracked changes)"
fi
branch="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
if git -C "$REPO_ROOT" fetch origin -q 2>/dev/null; then
  counts="$(git -C "$REPO_ROOT" rev-list --left-right --count "origin/$branch...HEAD" 2>/dev/null || echo '0 0')"
  behind="${counts%%[[:space:]]*}"; ahead="${counts##*[[:space:]]}"
  if [ "${behind:-0}" -gt 0 ] || [ "${ahead:-0}" -gt 0 ]; then
    bad "checkout diverged from origin/$branch ($behind behind, $ahead ahead)" "cd $REPO_ROOT && git pull --ff-only; push any local commits"
  else
    pass "checkout in sync with origin/$branch"
  fi
else
  note "could not fetch origin (offline?)" "drift-vs-origin check skipped; re-run with network"
fi

echo
if [ "$fail" -gt 0 ]; then echo "== $fail required check(s) FAILED, $warn warning(s) =="; exit 1
else echo "== all required checks passed ($warn warning(s)) =="; fi
