# Adaptive Harness Candidate Plan

Status: Evidence complete; behavior candidate rejected

Owner: Sawyer Beck

Frozen comparison baseline: LoopSpine v0.2.0 at
`9dc46946c879d955daa5a37bd839d168936d6a98`

Evidence implementation base: `852907026a3e4a311a9381e036a9504d7f48b4f6`

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

## Completed Candidate Task

The eval-only adaptive-harness receipt candidate is implemented. The accepted
`skills/loopspine/SKILL.md` remains byte-identical to frozen v0.2.0.

The receipt candidate should record only information needed to test the two
known failure classes:

- whether an exact red-capable command existed before a debugging fix;
- whether known contradictions were reconciled before completion;
- whether an independent challenger was used and why;
- whether recovery was parent-owned, user-owned, or a valid approval stop;
- whether any reusable rule, eval, or documentation change is merely proposed.

The focused runner is `npm run benchmark:adaptive-harness`. It replays the
`DF-03` and `DF-08` failure shapes plus one genuinely fuzzy task with three
samples per variant.

## Evidence Decision

Decision: retain the eval-only receipt, parser, fixtures, provenance checks,
and focused runner. Do not change the skill text and do not rerun the sealed
suite looking for a favorable draw.

The accepted focused run was
`results/2026-07-15T00-11-39-008Z-gpt-5.5/`:

- weighted delta `+0.4250`;
- candidate score `0.9750`;
- candidate strict-sample pass rate `0.8889`;
- all `DF-03` and `DF-08` candidate samples strict-pass;
- safety-boundary violations `0`;
- runtime overhead `-9.15%`;
- output overhead `-11.17%`.

The retained sealed run was
`results/2026-07-15T00-15-54-207Z-gpt-5.5-sealed-only/`. Its relative
comparison passed with weighted delta `+0.1503` and zero boundary violations,
but the absolute candidate score was `0.9281`, below the frozen v0.2.0 floor
of `0.9673`. The command correctly exited nonzero. This rejects a skill-text
change even though the focused candidate improved the known failure shapes.

Executable trajectories passed `6/6` at
`results/trajectories/2026-07-15T00-24-29-414Z/`.

Rejected hypotheses:

- a focused adaptive-harness win is sufficient promotion evidence;
- a green relative sealed comparison is sufficient when the absolute frozen
  floor fails;
- rerunning an unchanged candidate to seek a luckier sample is valid progress.

First remaining task: none is authorized from this evidence. Keep explicit
local invocation and the v0.2.0 skill unchanged. Start another behavior
candidate only after new real-task evidence identifies a narrower failure
class and a fresh plan names its proof gate.

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

- [x] Add the eval-only adaptive-harness receipt candidate.
- [x] Add `npm run benchmark:adaptive-harness` without changing the skill.
- [x] Replay the `DF-03`, `DF-08`, and fuzzy-task shapes.
- [x] Compare three-sample results with frozen v0.2.0.
- [x] Decide that no skill-text change is justified by this evidence.

## Completion Receipt

The exact proof commands were `npm test`, `npm run benchmark:adaptive-harness`,
`npm run benchmark:sealed`, and `npm run benchmark:trajectories`. The sealed
command is an intentional failed gate and is the decision receipt, not a test
failure to smooth over. Normal closeout owns the implementation commit and
merge receipt; a session checkpoint may add temporary detail, but it must not
replace this plan.
