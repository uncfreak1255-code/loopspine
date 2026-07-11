import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateDogfoodMetrics, renderDogfoodMarkdown } from "./dogfood-metrics.mjs";

const [runArg] = process.argv.slice(2);
if (!runArg) {
  console.error("Usage: node record-dogfood.mjs <completed-run.json>");
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registerPath = path.join(root, "dogfood", "register.json");
const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
const run = JSON.parse(fs.readFileSync(path.resolve(runArg), "utf8"));
const task = register.tasks.find((item) => item.id === run.id);
if (!task) throw new Error(`unknown dogfood task id: ${run.id}`);
if (task.status === "completed") throw new Error(`${run.id} is already completed`);
for (const key of ["repo", "task", "proof"]) if (!run[key]) throw new Error(`${run.id}: missing ${key}`);
if (run.loopspine_invoked !== true) throw new Error(`${run.id}: loopspine_invoked must be true`);
for (const key of ["verified", "incorrect_stop"]) if (typeof run[key] !== "boolean") throw new Error(`${run.id}: ${key} must be boolean`);
if (!Number.isInteger(run.sawyer_interventions) || run.sawyer_interventions < 0) throw new Error(`${run.id}: invalid sawyer_interventions`);
if (!Number.isFinite(run.time_to_proof_seconds) || run.time_to_proof_seconds <= 0) throw new Error(`${run.id}: invalid time_to_proof_seconds`);
Object.assign(task, run, { status: "completed", recorded_at: new Date().toISOString() });
const metrics = calculateDogfoodMetrics(register);
fs.writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);
fs.writeFileSync(path.join(root, "dogfood", "report.json"), `${JSON.stringify(metrics, null, 2)}\n`);
fs.writeFileSync(path.join(root, "dogfood", "report.md"), renderDogfoodMarkdown(metrics));
console.log(JSON.stringify({ recorded: run.id, report: metrics }, null, 2));
