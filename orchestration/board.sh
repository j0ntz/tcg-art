#!/usr/bin/env bash
# Minimal GitHub Projects board helper for the agent orchestration.
# Board: "Agent Orchestration" (#1, user j0ntz). Single-select field "Agent Status".
# Used by both the watcher (read Pending) and the agent (write status).
set -euo pipefail

OWNER="j0ntz"
PROJECT_NUMBER="1"
PROJECT_ID="PVT_kwHOD6Er384BbyER"
FIELD_ID="PVTSSF_lAHOD6Er384BbyERzhWgFFU"

opt_id() {
  case "$1" in
    Pending) echo "8e0dcfd2" ;;
    Running) echo "9579340e" ;;
    Blocked) echo "4d4643ae" ;;
    Done)    echo "400c6aca" ;;
    *)       echo "" ;;
  esac
}

items_json() {
  gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 200
}

case "${1:-}" in
  list-pending)
    # prints "<issue-number>\t<issue-url>" per Pending item
    items_json | node -e '
      const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
      for (const it of d.items||[]) {
        const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));
        const st=e?e[1]:"";
        if (st==="Pending" && it.content && it.content.number)
          console.log(it.content.number + "\t" + it.content.url);
      }'
    ;;
  item-id)
    items_json | node -e '
      const n=process.argv[1];
      const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
      const it=(d.items||[]).find(x=>x.content && String(x.content.number)===String(n));
      if(!it){console.error("no board item for issue #"+n);process.exit(3)}
      process.stdout.write(it.id);' "$2"
    ;;
  status)
    issue="$2"; status="$3"
    oid="$(opt_id "$status")"
    [ -z "$oid" ] && { echo "unknown status: $status (use Pending|Running|Blocked|Done)"; exit 2; }
    iid="$("$0" item-id "$issue")"
    gh project item-edit --id "$iid" --field-id "$FIELD_ID" --project-id "$PROJECT_ID" --single-select-option-id "$oid" >/dev/null
    echo "board: #$issue -> $status"
    ;;
  *)
    echo "usage: board.sh {list-pending | item-id <issue#> | status <issue#> <Pending|Running|Blocked|Done>}"; exit 2 ;;
esac
