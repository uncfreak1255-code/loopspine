import assert from "node:assert/strict";
import { calculateDogfoodMetrics } from "./dogfood-metrics.mjs";

const pending = Array.from({ length: 10 }, (_, index) => ({ id: `DF-${String(index + 1).padStart(2, "0")}`, status: "pending" }));
assert.equal(calculateDogfoodMetrics({ target_tasks: 10, tasks: pending }).verified_completion_rate, null);

const tasks = structuredClone(pending);
tasks[0] = { ...tasks[0], status: "completed", loopspine_invoked: true, verified: true, sawyer_interventions: 0, time_to_proof_seconds: 60, incorrect_stop: false, proof: "test A" };
tasks[1] = { ...tasks[1], status: "completed", loopspine_invoked: true, verified: false, sawyer_interventions: 1, time_to_proof_seconds: 180, incorrect_stop: true, proof: "test B" };
assert.deepEqual(calculateDogfoodMetrics({ target_tasks: 10, tasks }), {
  completed_tasks: 2,
  target_tasks: 10,
  verified_completion_rate: 0.5,
  sawyer_intervention_rate: 0.5,
  median_time_to_proof_minutes: 2,
  incorrect_stop_rate: 0.5
});

console.log("Dogfood metric tests passed: empty and completed pilots.");
