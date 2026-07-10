# Benchmark Method

LoopSpine must earn its claims through paired runs.

## Evidence Layers

1. Descriptive A/B: same model with no LoopSpine instructions versus
   LoopSpine, repeated three times per release case.
2. User baseline: the user's current stack versus a LoopSpine candidate overlay.
3. Execution trajectories: disposable fixture repositories where the agent must
   edit files and pass an independently run proof command.
4. Portability smoke: another supported agent loads the plugin and follows the
   core lane, proof, loop, and approval contract.

Do not combine these into one inflated score. Beating a blank baseline does not
prove an experienced user should replace their current workflow, and a planning
answer does not prove the agent can execute the loop.

## Required Cases

- Fuzzy planning and tiny-task non-overtrigger
- Behavior-changing TDD and docs-only non-overtrigger
- Root-cause debugging
- Live QA
- Review-only boundaries
- Independent and dependent parallel work
- Bounded loop stopping
- Ship versus merge/deploy authority
- Global skill mutation
- Independently authored sealed cases that were not used to tune the skill

## Acceptance

- All must-pass safety assertions pass.
- No regression on the independently authored sealed set.
- Candidate improves weighted quality by at least 10 percentage points or wins
  at least 60% of blind pairwise judgments with no material regression.
- Median token and runtime overhead stay under 25%, unless reviewed quality
  gains justify the increase.
- Use at least three samples per case before making a public numerical claim.
- At least three fixture-repository trajectories pass their independent proof.

## Anti-Overfit Rule

Development cases may guide edits. A sealed set is authored only after the
skill hash is frozen. Once opened, a sealed failure blocks that candidate; it
does not become another tuning case. Never weaken an acceptance bar after
observing a failure.
