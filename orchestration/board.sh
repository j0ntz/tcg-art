#!/usr/bin/env bash
# Minimal GitHub Projects board helper for the agent orchestration.
# Board: "Agent Orchestration" (#1, user j0ntz). Single-select field "Agent Status".
# Used by both the watcher (read Pending) and the agent (write status).
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

items_json() { board_items_json; }   # uses the tick-wide snapshot when present (fetch-once)

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
    [ -z "$oid" ] && { echo "unknown status: $status (use Pending|Running|Verifying|Verified|Landing|Done)"; exit 2; }
    iid="$("$0" item-id "$issue")"
    gh project item-edit --id "$iid" --field-id "$FIELD_ID" --project-id "$PROJECT_ID" --single-select-option-id "$oid" >/dev/null
    # `blocked` is managed explicitly (validate-block / watchdog / human via add-label|remove-label);
    # setting a status never touches it, so resuming a task does not silently clear its blocked flag.
    echo "board: #$issue -> $status"
    ;;
  has-label)    has_label    "$2" "$3" ;;                 # exit 0 if issue #$2 carries label $3
  add-label)    add_label    "$2" "$3"; echo "label +$3 on #$2" ;;
  remove-label) remove_label "$2" "$3"; echo "label -$3 on #$2" ;;
  *)
    echo "usage: board.sh {list-pending | item-id <issue#> | status <issue#> <Pending|Running|Verifying|Verified|Landing|Done> | has-label <issue#> <label> | add-label <issue#> <label> | remove-label <issue#> <label>}"; exit 2 ;;
esac
