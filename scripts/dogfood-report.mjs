import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateDogfoodMetrics, renderDogfoodMarkdown } from "./dogfood-metrics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const register = JSON.parse(fs.readFileSync(path.join(root, "dogfood", "register.json"), "utf8"));
const metrics = calculateDogfoodMetrics(register);
if (process.argv.includes("--write")) {
  fs.writeFileSync(path.join(root, "dogfood", "report.json"), `${JSON.stringify(metrics, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "dogfood", "report.md"), renderDogfoodMarkdown(metrics));
}
console.log(JSON.stringify(metrics, null, 2));
