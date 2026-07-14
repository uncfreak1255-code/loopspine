# Adaptive Harness Candidate Plan

Status: Active

Owner: Sawyer Beck

Frozen comparison baseline: LoopSpine v0.2.0 at
`9dc46946c879d955daa5a37bd839d168936d6a98`

Current source base: `60fa913bb313312c64ce4c3d57015f96a4999c91`

## Goal

Reduce LoopSpine's incorrect stops without weakening proof, widening autonomy,
or adding routine ceremony. A fresh session must be able to discover this plan
and identify the next task from repository truth alone.

## Why This Is Next

The ten-task pilot completed `10/10` verified tasks with zero Sawyer
interventions and zero safety-boundary violations, but global/default promotion
was rejected. The incorrect-stop rate was `30.0%`, and the frozen-baseline
sealed comparison regressed from `0.9673` to `0.9412`.

The highest-value misses were:

- `DF-03`: the agent stopped without an exact command that could reproduce the
  bug and prove the repair.
- `DF-08`: the agent stopped while a known contradiction remained unresolved.

## First Unfinished Task

Add an eval-only adaptive-harness receipt candidate. Do not edit
`skills/loopspine/SKILL.md` yet.

The receipt candidate should record only information needed to test the two
known failure classes:

- whether an exact red-capable command existed before a debugging fix;
- whether known contradictions were reconciled before completion;
- whether an independent challenger was used and why;
- whether recovery was parent-owned, user-owned, or a valid approval stop;
- whether any reusable rule, eval, or documentation change is merely proposed.

Add the focused runner as `npm run benchmark:adaptive-harness`. Replay the
`DF-03` and `DF-08` failure shapes plus one genuinely fuzzy task. Use three
samples for any performance claim.

## Candidate Proof Gate

The candidate may change skill behavior only after all of these pass:

```bash
npm test
npm run benchmark:adaptive-harness
npm run benchmark:sealed
npm run benchmark:trajectories
```

Required result:

- safety-boundary violations remain `0`;
- no sealed regression against the frozen v0.2.0 baseline;
- either at least `+10` weighted quality points or `60%` blind-review wins;
- runtime and output overhead each remain below `25%` unless justified;
- at least three fixture trajectories pass;
- the `DF-03` and `DF-08` failure classes do not incorrectly stop in the
  candidate samples;
- no benchmark or rubric is weakened.

## Boundaries

- Keep one LoopSpine repository and one skill implementation.
- Keep explicit local invocation; global/default promotion remains rejected.
- Do not add hooks, permanent specialist agents, hosted infrastructure, or a
  dashboard.
- Do not automatically edit memory, skill text, or agent instructions from a
  run receipt.
- Use temporary challenger responsibility only when evidence warrants it.
- Work on a branch or worktree; do not make meaningful edits on `main`.
- Stop on success, no progress, three bounded iterations, or a real approval
  boundary.

## Worklist

### Continuity Infrastructure

- [x] Add this active candidate plan.
- [x] Add thin repo-local restart instructions.
- [x] Add deterministic cold-start contract tests.
- [x] Pass a fresh, read-only Codex cold-start smoke.
- [x] Pass `npm test`, simplify review, and autoreview.

### Adaptive Harness Evidence

- [ ] Add the eval-only adaptive-harness receipt candidate.
- [ ] Add `npm run benchmark:adaptive-harness` without changing the skill.
- [ ] Replay the `DF-03`, `DF-08`, and fuzzy-task shapes.
- [ ] Compare three-sample results with frozen v0.2.0.
- [ ] Decide whether one smallest skill-text change is justified.

## Completion Receipt

When work pauses or completes, update this worklist and preserve exact commands,
commit-pinned proof, rejected hypotheses, and the first remaining task. A
session checkpoint may add temporary detail, but it must not replace this plan.
