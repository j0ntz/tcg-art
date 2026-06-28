# TCG-Art Orchestration Plan

> **Superseded by [orch-v2-spec.md](orch-v2-spec.md).** The original v1 ten-state pipeline (Pending/Running/Coded/Testing/Review/Address/Reviewed/Land/Landed/Blocked) described here was retired in the v2 rebuild.

The orch is a hands-off autonomous agent system for a **Next.js webapp on Vercel**, on a flat Claude subscription (no per-token billing). It is now a **task -> reviewed-deliverable engine** that handles **code, repo docs, and board-ops** on a **6-state machine** (Pending -> Running -> Verifying -> Verified -> Landing -> Done), forking on PR-presence.

- **Design source of truth:** [orch-v2-spec.md](orch-v2-spec.md) — states, the PR-presence path fork, labels (flavor / `auto-land` / `blocked`), skills, the migration record.
- **Operate / pick up:** [handoff.md](handoff.md) — what's live, the flow, gotchas, file map.
- **Bring up on a new machine:** [bring-up.md](bring-up.md).

What changed v1 -> v2: folded testing + review into one always-run **Verifying** stage (`verify-code` = preview-test + review, `verify-doc` = completeness + review); folded addressing into the work skill (review changes route back to **Running**); made `blocked` a label (preserves where it stuck); generalized beyond code via flavor labels and the PR-presence path fork; retired `auto-review`/`in-review` for `auto-land`.
