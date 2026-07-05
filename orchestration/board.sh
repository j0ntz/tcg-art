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
    # Done is terminal: close the issue here, scripted, so EVERY Done path gets closure for free
    # (code tasks auto-close via the PR's "Closes #n" -- this is then a no-op; no-PR ops/research
    # tasks previously left open husks, e.g. #11). Also keeps children_gate's closed-check honest.
    if [ "$status" = "Done" ]; then
      gh issue close "$issue" --repo "$REPO" >/dev/null 2>&1 || true
    fi
    echo "board: #$issue -> $status"
    ;;
  model)
    # Set the task's Agent Model single-select (what its spawned agents START on). The option
    # label -> CLI string mapping lives in orch.config.json agent.models; spawn_agent resolves it
    # via model_for at spawn time. Labels carry dots/spaces, so quote them: board.sh model 7 "Opus 4.8"
    issue="$2"; label="$3"
    oid="$(node -e 'const c=require(process.argv[1]);const o=((c.agent||{}).modelOptions||{})[process.argv[2]];process.stdout.write(o==null?"":String(o))' "$ORCH_CONFIG" "$label")"
    [ -z "$oid" ] && { echo "unknown model label: $label (see agent.modelOptions in orch.config.json)"; exit 2; }
    iid="$("$0" item-id "$issue")"
    gh project item-edit --id "$iid" --field-id "$(cfg agent.modelFieldId)" --project-id "$PROJECT_ID" --single-select-option-id "$oid" >/dev/null
    echo "board: #$issue agent model -> $label"
    ;;
  effort)
    # Set the task's Agent Effort single-select (reasoning effort its agents start on).
    # The option label IS the CLI value: low | medium | high | xhigh | max.
    issue="$2"; label="$3"
    oid="$(node -e 'const c=require(process.argv[1]);const o=((c.agent||{}).effortOptions||{})[process.argv[2]];process.stdout.write(o==null?"":String(o))' "$ORCH_CONFIG" "$label")"
    [ -z "$oid" ] && { echo "unknown effort level: $label (use low|medium|high|xhigh|max)"; exit 2; }
    iid="$("$0" item-id "$issue")"
    gh project item-edit --id "$iid" --field-id "$(cfg agent.effortFieldId)" --project-id "$PROJECT_ID" --single-select-option-id "$oid" >/dev/null
    echo "board: #$issue agent effort -> $label"
    ;;
  has-label)    has_label    "$2" "$3" ;;                 # exit 0 if issue #$2 carries label $3
  add-label)    add_label    "$2" "$3"; echo "label +$3 on #$2" ;;
  remove-label) remove_label "$2" "$3"; echo "label -$3 on #$2" ;;
  children)
    # per child of issue #$2: "<child#>\t<open|closed>\t<board-status>" ("" = not on the board).
    # Child list via ONE REST call; board statuses from the snapshot when present.
    subs="$(sub_issues_json "$2")"
    [ "$subs" = "[]" ] && exit 0
    items_json | SUBS="$subs" node -e '
      const subs=JSON.parse(process.env.SUBS||"[]");
      const board={};
      try{
        const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
        for(const it of d.items||[]){
          if(!it.content||!it.content.number)continue;
          const e=Object.entries(it).find(([k])=>/agent ?status/i.test(k));
          board[it.content.number]=e?e[1]:"";
        }
      }catch(e){}
      for(const s of subs)console.log(s.number+"\t"+s.state+"\t"+(board[s.number]||""));'
    ;;
  parent)       parent_of "$2" ;;                          # parent issue# ("" if none)
  gate)         children_gate "$2" ;;                      # none | ready | waiting:<done>/<total>
  add-child)
    # Link issue #$3 as a sub-issue of #$2. The REST param takes the child's int64 ID, not its
    # number; resolve it first (the "sub_issue_id is the ID" gotcha).
    cid="$(gh api "repos/$REPO/issues/$3" --jq .id)"
    gh api -X POST "repos/$REPO/issues/$2/sub_issues" -F sub_issue_id="$cid" >/dev/null
    echo "sub-issue: #$3 -> parent #$2"
    ;;
  *)
    echo "usage: board.sh {list-pending | item-id <issue#> | status <issue#> <Pending|Running|Verifying|Verified|Landing|Done> | model <issue#> \"<Fable 5|Opus 4.8|Opus 4.7|Sonnet 5|Sonnet 4.6>\" | effort <issue#> <low|medium|high|xhigh|max> | has-label <issue#> <label> | add-label <issue#> <label> | remove-label <issue#> <label> | children <issue#> | parent <issue#> | gate <issue#> | add-child <parent#> <child#>}"; exit 2 ;;
esac
