import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANDIDATE_SOURCE_BASE_COMMIT,
  FROZEN_BASELINE_COMMIT,
  REQUIRED_PROOF_COMMANDS,
  verifyColdStartResponse,
  verifyColdStartTrace
} from "./cold-start-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
const plan = fs.readFileSync(path.join(root, "docs", "plans", "adaptive-harness-candidate.md"), "utf8");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(agents, /docs\/plans\/adaptive-harness-candidate\.md/);
assert.match(agents, /npm run smoke:cold-start/);
assert.match(plan, /^Status: Active$/m);
assert.ok(plan.includes(FROZEN_BASELINE_COMMIT));
assert.ok(plan.includes(CANDIDATE_SOURCE_BASE_COMMIT));
assert.match(plan, /Add an eval-only adaptive-harness receipt candidate/);
for (const command of REQUIRED_PROOF_COMMANDS) assert.ok(plan.includes(command));
assert.equal(packageMetadata.scripts["smoke:cold-start"], "node scripts/run-cold-start-smoke.mjs");

const valid = {
  source_commit: CANDIDATE_SOURCE_BASE_COMMIT,
  frozen_baseline_commit: FROZEN_BASELINE_COMMIT,
  promotion_status: "rejected",
  next_task: "adaptive-harness-receipt-eval",
  proof_commands: [
    "npm test",
    "npm run benchmark:adaptive-harness",
    "npm run benchmark:sealed",
    "npm run benchmark:trajectories"
  ],
  main_edits_allowed: false,
  evidence_files: [
    "AGENTS.md",
    "docs/plans/adaptive-harness-candidate.md",
    "docs/plans/skill-spine-rollout.md",
    "dogfood/report.json"
  ]
};

assert.deepEqual(verifyColdStartResponse(valid), {
  source_commit_matches: true,
  baseline_matches: true,
  promotion_rejected: true,
  next_task_matches: true,
  proof_gate_complete: true,
  protected_branch_boundary: true,
  source_evidence_complete: true
});
assert.equal(
  verifyColdStartResponse({
    ...valid,
    promotion_status: "Global/default promotion rejected; explicit local use remains.",
    next_task: "Add the eval-only adaptive-harness receipt candidate."
  }).next_task_matches,
  true
);
assert.equal(
  verifyColdStartResponse({
    ...valid,
    source_commit: `${CANDIDATE_SOURCE_BASE_COMMIT} (Merge pull request #8)`
  }).source_commit_matches,
  true
);
assert.equal(
  verifyColdStartResponse({
    ...valid,
    evidence_files: valid.evidence_files.map((relativePath) => `/tmp/loopspine/${relativePath}`)
  }).source_evidence_complete,
  true
);
assert.throws(
  () => verifyColdStartResponse({ ...valid, source_commit: FROZEN_BASELINE_COMMIT }),
  /source commit/
);
assert.throws(
  () => verifyColdStartResponse({ ...valid, source_commit: `HEAD ${CANDIDATE_SOURCE_BASE_COMMIT}` }),
  /source commit/
);
assert.throws(
  () => verifyColdStartResponse({ ...valid, promotion_status: "approved" }),
  /promotion status/
);
assert.throws(
  () => verifyColdStartResponse({ ...valid, next_task: "Install globally" }),
  /next task/
);
assert.throws(
  () => verifyColdStartResponse({ ...valid, proof_commands: ["npm test"] }),
  /proof commands/
);
assert.throws(
  () => verifyColdStartResponse({ ...valid, main_edits_allowed: true }),
  /branch boundary/
);

const trace = [
  { type: "item.completed", item: { type: "command_execution", command: "git rev-parse HEAD" } },
  { type: "item.completed", item: { type: "command_execution", command: "sed -n '1,160p' AGENTS.md" } },
  { type: "item.completed", item: { type: "command_execution", command: "cat docs/plans/adaptive-harness-candidate.md" } },
  { type: "item.completed", item: { type: "command_execution", command: "cat docs/plans/skill-spine-rollout.md" } },
  { type: "item.completed", item: { type: "command_execution", command: "cat dogfood/report.json" } }
].map((event) => JSON.stringify(event)).join("\n");
assert.deepEqual(verifyColdStartTrace(trace), {
  git_head_read: true,
  active_plan_read: true,
  completed_rollout_read: true,
  dogfood_report_read: true
});
assert.throws(
  () => verifyColdStartTrace(trace.replace("dogfood/report.json", "README.md")),
  /dogfood\/report\.json/
);

console.log("Cold-start contract tests passed: source, decision, next task, proof, and branch boundary.");
