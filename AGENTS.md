# LoopSpine Repository Instructions

## Continue Or Resume

When the user asks to continue, resume, or identify the next LoopSpine task:

1. Read `git status --short --branch` and `git log -1 --oneline`.
2. Read `docs/plans/adaptive-harness-candidate.md` for active work.
3. Read `docs/plans/skill-spine-rollout.md` for the completed pilot decision.
4. Read `dogfood/report.json` and the relevant entries in
   `dogfood/register.json` for proof.
5. Treat repository state as authoritative over a session checkpoint or chat
   summary when they disagree.
6. Report the fresh source commit, first remaining task or explicit evidence
   hold, proof gate, and branch/worktree boundary before editing.

Use a branch or worktree for meaningful edits. Do not change the v0.2.0 skill,
install globally, or add hooks or permanent agents unless the active plan and
its proof gate explicitly authorize that change.

## Proof

Run `npm test` for repository changes. Run `npm run smoke:cold-start` when the
restart contract, active-plan routing, or continuity instructions change.
