---
name: loopspine
description: Use for non-trivial software work where the coding agent should plan, test, debug, review, and continue through bounded feedback loops until a real proof gate passes or a named stop condition fires. Especially use when asked to handle work end to end, keep going, work autonomously, use agents or worktrees, fix a regression, prepare a PR, or ship safely. Do not use for simple questions or tiny one-step edits.
license: MIT
metadata:
  author: Sawyer Beck
  version: "0.2.0"
---

# LoopSpine

Move a software task from intent to verified result without making the user
supervise routine execution. Use the smallest loop that fits the work.

## 1. Read Fresh State

Before consequential work:

1. Read the nearest repository instructions.
2. Check branch and working-tree state.
3. Identify the owning repository and files.
4. Name the exact proof command or observable result.

If the task is already complete, return a clean no-op receipt.

## 2. Choose One Lane

| Task shape | Lane |
|---|---|
| Tiny, obvious, one-step | direct |
| Fuzzy, consequential, or cross-surface | plan |
| New or changed executable behavior | build |
| Bug, failure, regression, or unexplained result | investigate |
| Live UI or product behavior | qa |
| Review without requested edits | review-only |
| Commit, push, PR, release preparation | ship |
| Merge or production rollout explicitly authorized | land-and-deploy |

Do not stack every lane. Advance only when the current lane produces its exit
evidence.

For a direct readback or verification request, skip planning ceremony: run the
exact check, make no change unless repair was requested or authorized, and
return the compact receipt.

## 3. Declare The Loop

For non-trivial work, keep this packet in working context. Do not narrate the
whole packet unless the user asks for the plan or the details clarify a blocker.

```yaml
lane: direct | plan | build | investigate | qa | review-only | ship | land-and-deploy
goal: observable condition that ends the task successfully
progress: evidence that must improve after a pass
budget: user-supplied limit, finite worklist, or no-progress stop
proof: exact command, receipt, screenshot, or live readback
stop: success | clean-no-op | no-progress | exhausted | blocked | approval-required
owner: lead agent responsible for integration and final verification
```

Do not invent a numeric budget when none is known. A finite worklist and a
no-progress stop are valid boundaries.

## 4. Run The Lane Loop

### Plan

Observe the code and current behavior, make scope and acceptance criteria
executable, pressure-test the plan, then stop planning. Advance when another
agent could implement without guessing about ownership, behavior, proof, or
rollback.

### Build

For behavior-changing code:

1. RED: write or select a focused test and watch it fail for the expected
   reason.
2. GREEN: make the smallest implementation that passes.
3. REFACTOR: simplify only the changed area while the test remains green.
4. Run the relevant broader check.

Do not force TDD onto prose-only docs, research, readbacks, generated snapshots,
or other work with no executable behavior. Those tasks still need a real proof.
For documentation or diagram changes, use the smallest applicable link check,
rendered preview, or exact readback instead of inventing a unit test.

### Investigate

Reproduce the failure, gather evidence, rank plausible hypotheses, test one
hypothesis at a time, fix the root cause, and add regression proof. Do not patch
the user's preferred theory before evidence supports it.

### QA

Run the actual user flow, observe the visible failure, make one bounded repair,
then rerun and verify the same flow under the same conditions. Final proof must
come from the repeated live flow, not only tests or an implementation diff.

### Review-Only

Inspect source and proof, return findings by severity with file references, and
make no edits. If no issue is found, say so and name residual test risk.

### Ship

Re-read current state, run the proof gate, inspect the intended diff, run the
required review, and publish only within current authorization or written repo
policy. A PR is not a deployment receipt.

### Land And Deploy

Require explicit authorization for the exact merge or deployment. Verify CI,
merge state, deployment, and live health before saying shipped.

## 5. Use Agents Deliberately

- Keep one lead agent responsible for decisions, integration, and final proof.
- Delegate independent, bounded work with exact ownership and output contracts.
- Use separate worktrees when agents write in parallel.
- Prefer subagents for read-heavy exploration, tests, logs, and independent
  review.
- Use an agent team only when workers must communicate; do not use one for
  sequential work or overlapping files.
- Never accept a child agent's completion claim without parent readback.

While workers run, the lead should make progress on a non-overlapping task.

## 6. Autonomy And Approval

Proceed autonomously with ordinary reversible work inside the authorized
repository: inspect, branch or use an existing worktree, edit scoped files, run
commands, test, debug, review, and repair.

Stop for approval before:

- writing global skills, profiles, hooks, memories, or agent configuration;
- mutating another repository not already authorized;
- destructive or irreversible cleanup;
- sending messages, purchases, account changes, or privacy-sensitive actions;
- push or PR creation when neither the user nor written repo policy allows it;
- merge, deploy, production data, credentials, or security policy changes.

Do not turn routine local file edits into user checkpoints.

For a skill, policy, prompt, or agent-configuration change, do not generalize
from one successful session. Compare the current baseline with a candidate on
representative working cases and untouched held-out cases before promotion.

## 7. Repeat Or Stop

After each pass:

1. Re-read the relevant state.
2. Run the same proof under recorded conditions.
3. Keep only a measurable improvement.
4. Record the result and next useful action.

Continue only when evidence changed and another pass can plausibly improve the
result. Stop on repeated identical failure, no new evidence, exhausted scope,
an approval boundary, or a passing goal predicate. Never weaken the test to make
the candidate win.

When the user asks for a fixed number of retries or readbacks, repeat only that
operation under the same recorded conditions. Do not insert unrequested repairs
between attempts. Reset an identical-failure streak only when the observed
failure signature materially changes.

## 8. Return The Receipt

```text
LANE: <lane>
RESULT: success | clean-no-op | no-progress | exhausted | blocked | approval-required
PROOF: <exact command or observable receipt and result>
BOUNDARY: <what was authorized and what was not>
RESIDUE: <remaining work, dirty state, blocker, or none>
```

For substantial work, also name changed files and independent review results.
For direct or routine work, return only the compact receipt plus one sentence of
useful context; do not restate the full workflow.
