# LoopSpine Skill Spine Rollout Spec

Status: Proposed for local pilot

Owner: Sawyer Beck

Baseline: LoopSpine v0.2.0 on `main` at `1b9701c`

## Decision

LoopSpine will remain one repository. The skill is the workflow engine and the
Codex and Claude plugin manifests are its delivery packages. During the pilot,
LoopSpine is invoked explicitly from the durable clone or installed into a
selected repository only. It must not become Sawyer's automatic global skill
spine until the ten-task pilot and the promotion checks in this spec pass.

The first plugin release remains skill-only. It does not add hooks, MCP servers,
apps, permanent specialist agents, or a new runtime.

## Current State

| Surface | Current status | Evidence |
|---|---|---|
| Durable repository | Ready | Clean `main` at `1b9701c` |
| Core skill | Ready for explicit use | `skills/loopspine/SKILL.md` |
| Codex package | Structurally ready | `.codex-plugin/plugin.json` |
| Claude package | Structurally ready | `.claude-plugin/plugin.json` and plugin validation |
| Installed-plugin access proof | Ready | `npm run probe:installed-plugin` |
| Dogfood pilot | Incomplete | `1/10`; public rates remain `Pending` |
| Automatic global routing | Blocked | Ten-task gate has not passed |
| Adaptive seniority trigger | Rejected | Candidate did not beat v0.2.0 |
| Hooks | Not justified | No repeated deterministic failure class recorded |

## Problem

Sawyer needs one dependable entry workflow for serious software tasks without
turning every session into a large agent stack. The entry workflow must help an
agent choose the smallest competent lane, continue through reversible local
work, prove the result independently, and stop at real approval boundaries.

The rollout must avoid three failure modes:

1. Installing an unproven workflow globally and making every task pay for it.
2. Replacing focused specialist skills with a broad duplicate implementation.
3. Adding permanent agents or hooks because the runtime supports them rather
   than because repeated evidence requires them.

## Goals

- Provide one explicit entry skill for non-trivial coding work.
- Package the same skill for Codex and Claude without forking behavior.
- Pilot it across real repositories with comparable receipts.
- Preserve specialist planning, debugging, QA, review, and shipping workflows.
- Measure completion, intervention, time to proof, and incorrect stopping.
- Make global promotion and rollback mechanical decisions based on evidence.

## Non-Goals

- An always-on autonomous platform or hosted dashboard.
- A marketplace of permanent specialist agents.
- Reimplementing Git, tests, browsers, CI, deployment, or model runtimes.
- Automatic global installation during the pilot.
- Planning, retry loops, or self-editing behavior in hooks.
- Claiming that a plugin load, benchmark score, or agent statement proves a real
  repository task was completed.

## Product Model

### Skill Is The Engine

`skills/loopspine/SKILL.md` owns only:

- fresh-state inspection;
- lane selection;
- bounded continuation and stopping;
- autonomy and approval boundaries;
- lead-agent integration responsibility;
- the final proof receipt.

It may route to an existing specialist, but it must not copy that specialist's
full instructions into LoopSpine.

### Plugin Is The Delivery Package

The repository provides two manifests around the same skill:

- `.codex-plugin/plugin.json` for Codex;
- `.claude-plugin/plugin.json` for Claude Code.

Both packages must expose the same version and the same skill files. A runtime-
specific probe or manifest may differ, but the workflow contract must not.

The pilot plugin contains no app, MCP server, hook, or permanent agent. Adding
one of those is a separately reviewed product change with its own proof gate.

### Runtime Supplies Execution

LoopSpine may use native tools already available in the active runtime:

- subagents for independent read-heavy or review work;
- worktrees for genuinely parallel writers;
- browser control for live product QA;
- tests, CI, and runtime readback for proof.

LoopSpine does not require a particular model, subagent implementation, or
agent-team framework.

## Invocation And Installation

### Allowed During Pilot

1. Explicit invocation from the durable clone:

   ```text
   $loopspine handle this task end to end and stop only at proof or a named boundary
   ```

2. Claude Code local plugin loading:

   ```bash
   claude --plugin-dir /absolute/path/to/loopspine
   ```

3. A repository-local skill link in a selected pilot repository:

   ```bash
   mkdir -p .agents/skills
   ln -s /absolute/path/to/loopspine/skills/loopspine .agents/skills/loopspine
   ```

Repository-local installation must be visible in that repository's status or
documented as a local-only ignored link. It must not silently rewrite global
configuration.

### Forbidden During Pilot

- Copying or linking LoopSpine into `~/.agents/skills`, `~/.codex/skills`, or
  `~/.claude/skills` as a global default.
- Making LoopSpine an automatic system-prompt or always-on instruction layer.
- Installing a global hook that invokes, retries, edits, or promotes the skill.
- Enabling a permanent team of role agents for every task.
- Publishing to a marketplace or recommending team-wide installation.

## Pilot Repository Selection

Use three repositories with different work shapes. At least one must be a
low-risk utility or lab repository. No first pilot task may require credentials,
production data, customer communication, payment behavior, or deployment.

The ten tasks must collectively include:

| Work shape | Minimum count |
|---|---:|
| Bug or regression with a focused reproduction | 2 |
| Behavior-changing feature with tests | 2 |
| Documentation or configuration readback | 1 |
| Investigation where the user's theory may be wrong | 1 |
| Live UI or runtime QA | 1 |
| Review-only task | 1 |
| Commit, push, or PR preparation with a publish boundary | 1 |
| Independent parallel work where a subagent or worktree is justified | 1 |

One task may satisfy more than one work shape, but all ten must be real tasks
with external proof. Synthetic benchmarks and the bundled demo do not count.

## Per-Task Procedure

1. Start from clean repository and branch/worktree readback.
2. Name the exact success condition and proof before implementation.
3. Invoke LoopSpine explicitly.
4. Allow reversible local work without routine user checkpoints.
5. Record every Sawyer intervention that changes direction or supplies a
   decision the agent could not recover itself.
6. Run the final proof independently of the agent's completion prose.
7. Record the task with `npm run dogfood:record -- completed-run.json`.
8. Preserve commit-pinned HTTPS proof references.
9. Review incorrect-stop and approval-boundary behavior before counting the
   task as verified.

## Temporary Role Compilation

Roles are responsibilities selected for one task, not permanent agent files.
The lead agent remains responsible for decisions, integration, and final proof.

| Temporary responsibility | Use when | Do not use when |
|---|---|---|
| Cartographer | Ownership, context, or unknowns are unclear | The exact file/check is already named |
| Builder | Executable behavior must change | Review-only or readback task |
| Skeptic | Assumptions or a non-trivial diff need independent challenge | Tiny mechanical edit with focused proof |
| Operator | CI, runtime, browser, deploy, or receipt readback matters | Unit-level behavior is the complete proof |
| Explainer | A real user-owned decision remains | The result is a compact direct receipt |
| Compounder | A repeated pattern has evidence across runs | A single interesting session |

Spawn a subagent only when its task is independently bounded and its result can
return as a summary or scoped diff. Use a separate worktree for parallel writers.
Do not create an agent team for sequential work or overlapping files.

## Metrics

The canonical register is `dogfood/register.json`. The generated reports are
`dogfood/report.json` and `dogfood/report.md`.

Measure:

- verified completion rate;
- Sawyer intervention rate;
- median time to proof;
- incorrect-stop rate;
- safety-boundary violations;
- runtime and output overhead when comparing skill candidates.

Public rates remain `Pending` until three real tasks are recorded. Any public
candidate-performance claim requires at least three samples under recorded
conditions.

## Promotion Gate

Global/default promotion requires every condition below:

- `10/10` real dogfood tasks recorded;
- verified completion rate at least `80%`;
- Sawyer intervention rate at most `20%`;
- no unresolved incorrect stop caused by weakened proof or approval handling;
- safety-boundary violations equal `0`;
- no sealed benchmark regression against frozen v0.2.0;
- either at least `+10` weighted quality points or `60%` blind-review wins for
  any behavior-changing skill candidate;
- runtime and output overhead each below `25%`, unless a written reviewed
  exception explains the tradeoff;
- at least three passing candidate fixture trajectories;
- `npm test` passes;
- Claude plugin validation passes;
- the installed-plugin probe passes from the packaged candidate;
- final autoreview has no accepted actionable findings;
- a human review confirms the skill still adds judgment support rather than
  ceremony to direct tasks.

Passing this gate permits a separate global-installation decision. It does not
silently authorize installation, marketplace publication, or automatic routing.

## Hook Admission Policy

A hook may be proposed only when all of the following are true:

1. The same deterministic failure class appears in at least three verified
   pilot runs across at least two repositories.
2. Prompt or skill wording did not reliably prevent it.
3. The hook can decide from structured event input without open-ended planning.
4. A focused fixture proves allowed behavior still passes and forbidden
   behavior fails closed.
5. Runtime overhead is measured and acceptable.
6. Removal is one reversible plugin change.

Allowed hook purposes:

- session inventory receipts;
- pre-tool safety checks;
- post-tool receipt capture;
- subagent result contract validation;
- post-compaction state restoration;
- preventing an unsupported completion claim.

Forbidden hook purposes:

- choosing the workflow or agent team;
- open-ended planning;
- unbounded retry loops;
- self-editing skills or configuration;
- automatic global promotion;
- publishing, messaging, merging, or deploying beyond existing authorization.

## Versioning And Release

- Keep one semantic version across both plugin manifests and skill metadata.
- A documentation or proof-infrastructure change may remain within v0.2.x when
  it does not change workflow behavior.
- Any change to trigger, autonomy, approval, or stopping behavior requires a
  candidate version and the full promotion comparison.
- Tag or publish only after tests, sealed proof, trajectories, plugin validation,
  autoreview, and release documentation agree.
- Marketplace publication is out of scope for the local pilot.

## Rollback

The pilot rollback is removal of the repository-local link or omission of
`--plugin-dir` on the next session. No global state should need repair.

For a rejected candidate:

1. Restore `skills/loopspine/SKILL.md` to the last accepted hash.
2. Remove candidate-only references, commands, agents, or hooks.
3. Retain independently useful evals, parsers, and benchmark receipts.
4. Record the rejection and exact failed gate.
5. Do not count a successful packaging or access probe as task-quality proof.

## Implementation Worklist

### Phase 0: Current Baseline

- [x] Keep one durable repository.
- [x] Keep the skill as the workflow engine.
- [x] Provide Codex and Claude plugin manifests.
- [x] Validate the Claude plugin.
- [x] Prove an installed-plugin file-access event.
- [x] Keep global skill directories unchanged.
- [x] Record DF-01.

### Phase 1: Local Pilot

- [ ] Select three pilot repositories.
- [ ] Document the repo-local invocation method for each.
- [ ] Complete and record DF-02 through DF-10.
- [ ] Review metrics after DF-03, DF-06, and DF-10.
- [ ] Record false triggers, unnecessary ceremony, and incorrect stops.
- [ ] Keep each proof reference pinned to an immutable commit.

### Phase 2: Promotion Review

- [ ] Run `npm test`.
- [ ] Run `npm run benchmark:pilot` as a diagnostic only.
- [ ] Run the frozen-baseline sealed comparison with three samples.
- [ ] Run `npm run benchmark:trajectories`.
- [ ] Validate both plugin manifests and run the installed-plugin probe.
- [ ] Run simplify and autoreview.
- [ ] Write the ten-task decision: promote, revise, or reject.

### Phase 3: Optional Global Adoption

- [ ] Obtain explicit approval for global installation.
- [ ] Install one versioned plugin package rather than copying loose skill files.
- [ ] Run one low-risk smoke task in a fresh session.
- [ ] Verify invocation, proof receipt, and uninstall path.
- [ ] Monitor the first five global uses for false triggers or extra ceremony.

## Required Receipts

At pilot close, report:

- repositories and task categories used;
- plugin version and skill hash;
- all ten task proof references;
- four operating metrics;
- safety and incorrect-stop residue;
- benchmark and trajectory summaries;
- plugin validation and access-probe result;
- hooks or permanent agents added, expected to be none unless separately proven;
- global promotion decision and rollback command.

## Acceptance Criteria For This Spec

This spec is implementation-ready when:

- it preserves one repository and one skill implementation;
- local, repository, and global installation boundaries are unambiguous;
- all ten tasks have a selection and recording procedure;
- temporary roles cannot silently become permanent agents;
- hook admission requires repeated deterministic evidence;
- the global promotion gate is mechanical and stricter than packaging success;
- rejected candidates have a preserve-useful-evidence rollback path;
- no step requires creating a new repository, hosted service, or global config
  change during the pilot.
