import assert from "node:assert/strict";
import { calculateDogfoodMetrics } from "./dogfood-metrics.mjs";

const pending = Array.from({ length: 10 }, (_, index) => ({ id: `DF-${String(index + 1).padStart(2, "0")}`, status: "pending" }));
assert.equal(calculateDogfoodMetrics({ target_tasks: 10, tasks: pending }).verified_completion_rate, null);

const proofReferences = [{
  type: "commit",
  url: "https://github.com/example/repo/commit/0123456789abcdef0123456789abcdef01234567",
  commit: "0123456789abcdef0123456789abcdef01234567"
}];
const tasks = structuredClone(pending);
tasks[0] = { ...tasks[0], status: "completed", loopspine_invoked: true, verified: true, sawyer_interventions: 0, time_to_proof_seconds: 60, incorrect_stop: false, proof: "test A", proof_references: proofReferences };
tasks[1] = { ...tasks[1], status: "completed", loopspine_invoked: true, verified: false, sawyer_interventions: 1, time_to_proof_seconds: 180, incorrect_stop: true, proof: "test B", proof_references: proofReferences };
assert.deepEqual(calculateDogfoodMetrics({ target_tasks: 10, tasks }), {
  completed_tasks: 2,
  target_tasks: 10,
  minimum_public_samples: 3,
  verified_completion_rate: null,
  sawyer_intervention_rate: null,
  median_time_to_proof_minutes: null,
  incorrect_stop_rate: null
});

tasks[2] = { ...tasks[2], status: "completed", loopspine_invoked: true, verified: true, sawyer_interventions: 0, time_to_proof_seconds: 300, incorrect_stop: false, proof: "test C", proof_references: proofReferences };
assert.deepEqual(calculateDogfoodMetrics({ target_tasks: 10, tasks }), {
  completed_tasks: 3,
  target_tasks: 10,
  minimum_public_samples: 3,
  verified_completion_rate: 0.6667,
  sawyer_intervention_rate: 0.3333,
  median_time_to_proof_minutes: 3,
  incorrect_stop_rate: 0.3333
});

const missingReferences = structuredClone(tasks);
delete missingReferences[0].proof_references;
assert.throws(() => calculateDogfoodMetrics({ target_tasks: 10, tasks: missingReferences }), /proof_references/);

const mutableReference = structuredClone(tasks);
mutableReference[0].proof_references[0].url = "https://github.com/example/repo/blob/main/receipt.json";
assert.throws(() => calculateDogfoodMetrics({ target_tasks: 10, tasks: mutableReference }), /pinned to the full commit/);

const querySpoof = structuredClone(tasks);
querySpoof[0].proof_references[0].url = `https://github.com/example/repo/blob/main/receipt.json?commit=${proofReferences[0].commit}`;
assert.throws(() => calculateDogfoodMetrics({ target_tasks: 10, tasks: querySpoof }), /pinned to the full commit/);

console.log("Dogfood metric tests passed: sample floor, completed pilots, and proof references.");
