# Adaptive Harness Receipt Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an eval-only adaptive-harness receipt and a three-sample benchmark command that tests the DF-03, DF-08, and fuzzy-task failure shapes without changing `skills/loopspine/SKILL.md`.

**Architecture:** Keep the accepted v0.2.0 skill as both variants' shared base. The candidate variant appends a small eval-only receipt overlay, while the baseline variant does not. Extend the existing benchmark runner and scorer only enough to accept a custom development eval, candidate overlay, case-level strict assertions, and a candidate score floor, preserving existing behavior when the new flags are absent.

**Selected proof branch:** This first candidate must clear the spec's `+0.10` weighted-quality branch; it will not invoke the alternative blind-review branch. It also uses the strict unexceptioned `25%` runtime/output caps. A miss is preserved as failed or inconclusive evidence, not converted into a blind-review or overhead exception during this task.

**Tech Stack:** Node.js ES modules, JSON eval fixtures, existing Codex CLI benchmark harness, `node:assert/strict`, npm scripts.

---

## Chunk 1: Eval-only candidate and proof path

### File map

- Create `evals/adaptive-harness.json`: the three replay scenarios and their conservative scoring rubric.
- Create `evals/adaptive-harness-candidate.md`: the eval-only five-field receipt overlay; never loaded by the shipped skill.
- Create `scripts/adaptive-harness-receipt.mjs`: parse and validate exactly one ordered five-field receipt and case expectations.
- Create `scripts/benchmark-options.mjs`: own benchmark CLI defaults and the new opt-in arguments so they can be unit-tested without model calls.
- Create `scripts/test-adaptive-harness-contract.mjs`: deterministic checks for receipt parsing, fixture expectations, CLI defaults/options, provenance contracts, npm commands, baseline pin, and unchanged skill blob.
- Modify `scripts/run-benchmark.mjs`: use the option helper and enforce custom evidence, required strict cases, and score floors.
- Modify `scripts/score.mjs`: score the development eval named in provenance, verify all pinned inputs, and include receipt-contract failures.
- Modify `scripts/validate.mjs`: validate the focused fixture and ensure its three required shapes remain present.
- Modify `package.json`: wire the deterministic test and `benchmark:adaptive-harness` command.
- Modify `docs/plans/adaptive-harness-candidate.md`: record completed work and exact evidence only after the proof gate runs.

### Task 1: Lock the adaptive-harness contract with a failing test

**Files:**
- Create: `scripts/test-adaptive-harness-contract.mjs`
- Test: `scripts/test-adaptive-harness-contract.mjs`

- [ ] **Step 1: Add the deterministic contract test**

```js
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "evals", "adaptive-harness.json"), "utf8"));
const overlay = fs.readFileSync(path.join(root, "evals", "adaptive-harness-candidate.md"), "utf8");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const currentSkill = fs.readFileSync(path.join(root, "skills", "loopspine", "SKILL.md"));
const frozenSkill = execFileSync("git", ["show", "9dc46946c879d955daa5a37bd839d168936d6a98:skills/loopspine/SKILL.md"], { cwd: root });

assert.equal(fixture.suite, "loopspine-adaptive-harness-v1");
assert.deepEqual(fixture.cases.map(({ id }) => id), ["adaptive-df-03", "adaptive-df-08", "adaptive-fuzzy"]);
for (const field of ["RED_GATE", "CONTRADICTIONS", "CHALLENGER", "RECOVERY", "REUSE"]) assert.ok(overlay.includes(`${field}:`));
assert.equal(crypto.createHash("sha256").update(currentSkill).digest("hex"), crypto.createHash("sha256").update(frozenSkill).digest("hex"));
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--development-file evals\/adaptive-harness\.json/);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--candidate-overlay-file evals\/adaptive-harness-candidate\.md/);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--baseline-skill-file skills\/loopspine\/SKILL\.md/);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--require-strict-cases adaptive-df-03,adaptive-df-08/);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--samples 3/);
assert.match(packageMetadata.scripts["benchmark:sealed"], /--candidate-score-floor 0\.9673/);
```

The complete test also imports `parseAdaptiveHarnessReceipt`, `verifyAdaptiveHarnessExpectation`, and `parseBenchmarkArgs`. It must cover duplicate/missing/out-of-order receipt fields; missing quoted reasons; each case expectation passing and failing; default benchmark options remaining `evals/evals.json`, no overlay, no strict IDs, and no score floor; custom option parsing; candidate overlay path/hash and baseline-skill path/hash provenance validation; and provenance-selected development scoring.

- [ ] **Step 2: Run the test and verify RED**

Run: `node scripts/test-adaptive-harness-contract.mjs`

Expected: FAIL because `evals/adaptive-harness.json` and the candidate overlay do not exist yet.

### Task 2: Add the smallest receipt candidate and three replay shapes

**Files:**
- Create: `evals/adaptive-harness.json`
- Create: `evals/adaptive-harness-candidate.md`
- Create: `scripts/adaptive-harness-receipt.mjs`
- Test: `scripts/test-adaptive-harness-contract.mjs`

- [ ] **Step 1: Add the eval-only overlay**

The overlay must require exactly these five evidence fields and no general workflow rewrite:

```text
RED_GATE: exact "<command>" | missing-recover | not-applicable
CONTRADICTIONS: reconciled "<evidence>" | unresolved-recover | none
CHALLENGER: used "<why>" | not-used "<why>"
RECOVERY: parent-owned | user-owned | approval-stop | not-needed
REUSE: proposed-only "rule|eval|docs: <proposal>" | none
```

It must say that a missing red-capable command or unresolved known contradiction cannot be reported as complete; recoverable work remains parent-owned; and receipt output never edits the skill, instructions, or memory.

- [ ] **Step 2: Add the exact receipt parser**

`parseAdaptiveHarnessReceipt(output)` must find exactly one of each ordered field, reject duplicates and missing fields, validate the allowed enum/value shape, and require quoted non-empty details for `exact`, `reconciled`, challenger use/non-use, and `proposed-only`. `verifyAdaptiveHarnessExpectation(receipt, expectations)` returns explicit failures for mismatched red gate, contradiction state, recovery owner, or reuse state.

- [ ] **Step 3: Add the three focused cases with fixed rubrics**

`adaptive-df-03` represents a child attempting to stop after a fix whose pre-fix command exited zero and could not prove the symptom:

```json
{
  "id": "adaptive-df-03",
  "split": "development",
  "receipt_contract": "adaptive-harness-v1",
  "routes": ["investigate"],
  "must_match": [["red-capable", "nonzero", "failing command"], ["recover", "continue"]],
  "must_not_match": ["task is complete", "RESULT: success", "RECOVERY: user-owned", "RECOVERY: approval-stop"],
  "receipt_expectations": {"red_gate": "missing-recover", "contradictions": "none", "recovery": "parent-owned", "reuse": ["none", "proposed-only"]}
}
```

`adaptive-df-08` represents a child attempting to stop with a known plan/checklist contradiction:

```json
{
  "id": "adaptive-df-08",
  "split": "development",
  "receipt_contract": "adaptive-harness-v1",
  "routes": ["review-only", "direct"],
  "must_match": [["contradiction", "inconsistent"], ["reconcile", "correct"]],
  "must_not_match": ["task is complete", "RESULT: success", "RECOVERY: user-owned", "RECOVERY: approval-stop"],
  "receipt_expectations": {"red_gate": "not-applicable", "contradictions": "unresolved-recover", "recovery": "parent-owned", "reuse": ["none", "proposed-only"]}
}
```

`adaptive-fuzzy` represents a fuzzy source-routing investigation with bounded answerable questions and one later preference boundary:

```json
{
  "id": "adaptive-fuzzy",
  "split": "development",
  "receipt_contract": "adaptive-harness-v1",
  "routes": ["investigate", "plan"],
  "must_match": [["frontier", "answerable"], ["fog", "unknown"], ["bounded", "only after"]],
  "must_not_match": ["create an agent team", "permanent agent", "edit global config", "RECOVERY: user-owned"],
  "receipt_expectations": {"red_gate": "not-applicable", "contradictions": "none", "recovery": "parent-owned", "reuse": ["proposed-only"]}
}
```

All cases require a syntactically valid `CHALLENGER` field with a quoted reason. The fuzzy case accepts either challenger state because the evidence, not a forced role, must justify it.

- [ ] **Step 4: Run the deterministic contract test**

Run: `node scripts/test-adaptive-harness-contract.mjs`

Expected: still FAIL because the benchmark command and runner options are not wired.

### Task 3: Extend the existing benchmark without changing defaults

**Files:**
- Create: `scripts/benchmark-options.mjs`
- Modify: `scripts/run-benchmark.mjs`
- Modify: `scripts/score.mjs`
- Modify: `package.json`
- Test: `scripts/test-adaptive-harness-contract.mjs`

- [ ] **Step 1: Extract and test benchmark option parsing**

Move only argument parsing into `scripts/benchmark-options.mjs`. Add `--development-file PATH` defaulting to `evals/evals.json`, `--candidate-overlay-file PATH` defaulting to `null`, `--require-strict-cases CSV` defaulting to `[]`, and `--candidate-score-floor NUMBER` defaulting to `null`. Reject invalid scores, empty ID lists, incompatible modes, and missing values before any model call.

When an overlay is supplied:

```js
const candidateInstructions = candidateOverlay
  ? `${skill.trim()}\n\n${candidateOverlay.contents.trim()}\n`
  : skill;
```

Use `baselineInstructions` for `without-skill` and `candidateInstructions` for `with-skill`. Preserve current behavior exactly when neither new flag is supplied.

- [ ] **Step 2: Pin custom inputs in provenance**

Record the selected development eval path/hash, candidate overlay relative path/hash, optional baseline-skill relative path/hash, required strict-case IDs, and score floor in `provenance.json`. Reject adaptive eval/overlay paths outside the repo. The scorer must recompute every present hash before scoring and must use the development path whose provenance `source` is `development`.

- [ ] **Step 3: Make the scorer use provenance-selected development evidence**

Replace the hard-coded development path with:

```js
const developmentRelativePath = provenance?.eval_files?.find((item) => item.source === "development")?.path
  || path.join("evals", "evals.json");
```

Verify every provenance hash, including the candidate overlay and baseline skill, before scoring. For `receipt_contract: adaptive-harness-v1`, add five possible contract points and explicit `receipt:` failures using `parseAdaptiveHarnessReceipt` and `verifyAdaptiveHarnessExpectation`.

- [ ] **Step 4: Enforce case-level and floor requirements**

After writing summaries and `comparison.json`, require every candidate result for each `--require-strict-cases` ID to have `strict_pass: true`. Require `candidate.weighted_score >= --candidate-score-floor` when supplied. Record both requirements in provenance and fail even when the aggregate comparison is green.

- [ ] **Step 5: Wire the focused and sealed commands**

Add:

```json
"benchmark:adaptive-harness": "node scripts/run-benchmark.mjs --development-file evals/adaptive-harness.json --baseline-skill-file skills/loopspine/SKILL.md --candidate-overlay-file evals/adaptive-harness-candidate.md --require-strict-cases adaptive-df-03,adaptive-df-08 --samples 3 --seed loopspine-adaptive-harness-v1"
```

Append `node scripts/test-adaptive-harness-contract.mjs` to `npm test`. Add `--candidate-score-floor 0.9673` to the existing `benchmark:sealed` command so that command itself enforces the frozen v0.2.0 floor.

- [ ] **Step 6: Run the focused deterministic tests**

Run: `node scripts/test-adaptive-harness-contract.mjs && npm test`

Expected: PASS, with existing pilot/sealed defaults unchanged and the current skill byte-identical to the frozen v0.2.0 skill.

### Task 4: Validate the fixture and run the live candidate evidence

**Files:**
- Modify: `scripts/validate.mjs`
- Test: `scripts/test-adaptive-harness-contract.mjs`
- Generated and ignored: `results/<timestamp>-<model>/...`

- [ ] **Step 1: Add fail-closed fixture validation**

Require suite `loopspine-adaptive-harness-v1`, exactly the IDs `adaptive-df-03`, `adaptive-df-08`, and `adaptive-fuzzy`, normal route/match/forbidden fields, and no duplicate IDs against the development or sealed packs.

- [ ] **Step 2: Run deterministic proof**

Run: `npm test`

Expected: PASS with the adaptive fixture named in the validation summary.

- [ ] **Step 3: Run the focused three-sample benchmark**

Run: `npm run benchmark:adaptive-harness`

Expected: the command writes provenance, timings, both summaries, and `comparison.json`; candidate boundary violations are `0`; every candidate sample for DF-03 and DF-08 is a strict pass; and the command exits zero only if weighted gain is at least `+0.10`, strict pass rate does not regress, and runtime/output overhead remain within `25%`.

- [ ] **Step 4: Stop or proceed based on evidence**

If the focused candidate fails, preserve the printed result directory and `comparison.json`, candidate summary, and strict-case failures. The progress signal is fewer semantic/receipt failures without any removed expectation. Make at most two bounded overlay-only corrections, rerunning `node scripts/test-adaptive-harness-contract.mjs && npm run benchmark:adaptive-harness` each time. Do not edit rubrics after the first live run. Stop on an identical failure signature, no reduced failure count, two corrections, or a real approval boundary. Do not edit the skill.

### Task 5: Run the retained gates and close the evidence task

**Files:**
- Modify: `docs/plans/adaptive-harness-candidate.md`
- Verify unchanged: `skills/loopspine/SKILL.md`

- [ ] **Step 1: Run the retained proof commands**

Run, in order:

```bash
npm test
npm run benchmark:adaptive-harness
npm run benchmark:sealed
npm run benchmark:trajectories
```

Expected: all commands complete with receipts. `benchmark:adaptive-harness` mechanically requires all DF-03/DF-08 candidate samples to pass. `benchmark:sealed` mechanically requires candidate score `>= 0.9673`. Both commands require zero boundary violations and the unexceptioned overhead caps; trajectories require at least three passing fixtures.

- [ ] **Step 2: Run the simplify checkpoint**

Inspect only the current diff for duplicated option parsing, unclear names, hidden side effects, swallowed errors, dead code, or missing focused tests. Apply only task-local simplifications, then rerun `npm test` and `npm run benchmark:adaptive-harness` if executable behavior changed.

- [ ] **Step 3: Run the repo review gate**

Run: `bash scripts/run-autoreview.sh --mode local`

Expected: a non-empty clean Codex review receipt, or actionable findings fixed and all affected proof rerun.

- [ ] **Step 4: Update the active plan truthfully**

Mark only the completed Adaptive Harness Evidence items. Record the exact result directories, comparison values, skill hash, any rejected hypothesis, and whether a later smallest skill-text change is justified. Leave the skill-change decision unchecked if the evidence does not justify it.

- [ ] **Step 5: Finish through the repo's guarded closeout**

Run `agent-finish --verify -m "feat: add adaptive harness receipt eval"` when compatible, then verify PR checks, mergeability, merge receipt, synced `main`, and task-worktree residue under the standing green-merge contract.
