#!/usr/bin/env bash
# Verify a PR's Vercel PREVIEW deployment: resolve its URL, assert it is live,
# and capture a screenshot as proof. Replaces the prose-bar verification.
#
# Usage: verify-preview.sh <pr-number> [expected-substring]
# Stdout contract (the agent parses these):
#   PREVIEW_URL=<url>
#   HTTP_STATUS=<code>
#   SCREENSHOT=<path>             (desktop-width PNG proof; commit it + reference it in the PR)
#   SCREENSHOT_MOBILE=<path>      (mobile-width PNG proof; required in every run report)
#   RESULT=pass|fail
# Exit 0 on pass, non-zero on fail.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"   # REPO, etc.

PR="${1:?usage: verify-preview.sh <pr#> [expected-substring]}"
EXPECT="${2:-}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TIMEOUT_S="${PREVIEW_TIMEOUT_S:-480}"   # wait up to 8 min for the preview to be Ready
INTERVAL_S="${PREVIEW_INTERVAL_S:-15}"

sha="$(gh pr view "$PR" --repo "$REPO" --json headRefOid -q .headRefOid 2>/dev/null || true)"
[ -z "$sha" ] && { echo "RESULT=fail"; echo "ERROR=could not resolve PR #$PR head sha"; exit 1; }
echo "HEAD_SHA=$sha"

resolve_url() {
  # 1) GitHub Deployments created by the Vercel integration (preferred: structured + Ready state)
  gh api "repos/$REPO/deployments?sha=$sha&per_page=50" --jq '.[].id' 2>/dev/null | while read -r did; do
    gh api "repos/$REPO/deployments/$did/statuses?per_page=20" --jq '.[] | select(.state=="success") | .environment_url' 2>/dev/null
  done | grep -E '^https?://' | grep -v 'vercel.com' | head -1
  # 2) fallback: the Vercel bot's PR comment
  if [ -z "${REPLY:-}" ]; then
    gh pr view "$PR" --repo "$REPO" --json comments \
      --jq '.comments[].body' 2>/dev/null | grep -oE 'https://[a-z0-9._-]+\.vercel\.app[a-z0-9/_-]*' | head -1
  fi
}

url=""
deadline=$(( $(date +%s) + TIMEOUT_S ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  url="$(resolve_url | head -1)"
  [ -n "$url" ] && break
  sleep "$INTERVAL_S"
done
[ -z "$url" ] && { echo "RESULT=fail"; echo "ERROR=no Ready preview deployment for $sha within ${TIMEOUT_S}s"; exit 1; }
echo "PREVIEW_URL=$url"

body="/tmp/preview-$PR.html"
code="$(curl -sS -o "$body" -w '%{http_code}' -L "$url" 2>/dev/null || echo 000)"
echo "HTTP_STATUS=$code"

ok=1
[ "$code" = "200" ] || ok=0
grep -qiE "Application error|DEPLOYMENT_NOT_FOUND|404: NOT_FOUND|_vercel/sso" "$body" 2>/dev/null && ok=0
if [ -n "$EXPECT" ]; then grep -qiF "$EXPECT" "$body" 2>/dev/null || ok=0; fi

# Desktop-width capture.
shot="/tmp/preview-$PR.png"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1600,2600 --screenshot="$shot" "$url" >/dev/null 2>&1 || true
if [ -s "$shot" ]; then echo "SCREENSHOT=$shot"; else echo "SCREENSHOT=none"; ok=0; fi

# Mobile-width capture (iPhone-class viewport) so mobile rendering is proven, not
# assumed. Both screenshots belong in the run report.
shot_mobile="/tmp/preview-$PR-mobile.png"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=390,844 --screenshot="$shot_mobile" "$url" >/dev/null 2>&1 || true
if [ -s "$shot_mobile" ]; then echo "SCREENSHOT_MOBILE=$shot_mobile"; else echo "SCREENSHOT_MOBILE=none"; ok=0; fi

if [ "$ok" = 1 ]; then echo "RESULT=pass"; exit 0; else echo "RESULT=fail"; exit 1; fi
