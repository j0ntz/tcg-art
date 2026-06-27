---
name: land-task
description: Land ONE approved PR (a board task in the Land state) when a clean rebase isn't possible — rebase onto main resolving conflicts SEMANTICALLY, verify the build, squash-merge, set Landed. This is the sanctioned merge path; only for Land-state tasks. Invoked as `/land-task <issue-url>` by the lander on conflict.
---

<goal>Land the PR for the given task: rebase its branch onto latest `origin/main`, semantically resolving any conflicts, verify the build, squash-merge to main, delete the branch, and set the board to Landed. Hands-off, one turn.</goal>

<rules>
<rule id="this-is-the-merge">Unlike `/run-task`, landing DOES merge — that is the entire job. Squash-merge the approved PR to `main` and delete its branch. (This is the one sanctioned merge in the orchestration; it only runs for tasks a human moved to `Land`.)</rule>
<rule id="semantic-resolution-no-block">Do NOT block on rebase conflicts — RESOLVE them. For each conflicted file, merge BOTH sides so the PR's intent AND main's newer changes are preserved (`ours`/HEAD = main being rebased onto; `theirs` = the PR's commit). Remove every conflict marker with a correct, working merge. For lockfiles (`package-lock.json`) do NOT hand-merge — take one side then regenerate with the package manager (`npm install`). Set `Blocked` ONLY for a genuine NON-conflict wall (the build can't be made to pass, or GitHub rejects the merge for a non-conflict reason). A mere conflict is never a reason to block.</rule>
<rule id="verify-after-resolve">After resolving + rebasing, run `npm run build` (prefix `sfw` if required). It MUST pass before you merge; if your resolution broke it, fix it. Optionally re-run `bash orchestration/verify-preview.sh <pr#>` on the rebased HEAD.</rule>
<rule id="hands-off">One turn, no interactive questions. You are unattended.</rule>
</rules>

<step id="1" name="Locate">Parse the issue number from `/land-task <url>`. Find its PR: `gh pr list --repo j0ntz/tcg-art --head jon/task-<n> --state open --json number`. You are launched in the task's worktree on `jon/task-<n>`; confirm `git status` / `git branch --show-current`.</step>

<step id="2" name="Rebase onto main, resolving">`git fetch origin`; `git rebase origin/main`. On each conflict stop: resolve every file in `git diff --name-only --diff-filter=U` per `semantic-resolution-no-block`, `git add` them, then `GIT_EDITOR=true git rebase --continue`. Repeat until the rebase finishes.</step>

<step id="3" name="Verify">`npm run build` must pass. If your merge broke it, fix and re-run.</step>

<step id="4" name="Push + squash-merge">`git push --force-with-lease`, then `gh pr merge <pr> --repo j0ntz/tcg-art --squash --delete-branch`.</step>

<step id="5" name="Landed">`bash orchestration/board.sh status <n> Landed`. Comment on the issue: what merged + how you resolved each conflict (so the resolution is auditable). Print a one-line summary, then stop.</step>
