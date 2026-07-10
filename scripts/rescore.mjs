import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [runArg] = process.argv.slice(2);
if (!runArg) {
  console.error("Usage: node rescore.mjs <run-dir>");
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runDir = path.resolve(runArg);
const provenance = JSON.parse(fs.readFileSync(path.join(runDir, "provenance.json"), "utf8"));
const caseIds = provenance.cases.map((item) => item.id).join(",");
const mode = provenance.sealed_only ? "--sealed-only" : provenance.sealed ? "--sealed" : null;

for (const variant of ["without-skill", "with-skill"]) {
  const args = [path.join(root, "scripts", "score.mjs"), runDir, variant, caseIds, "--samples", String(provenance.samples)];
  if (mode) args.push(mode);
  const scored = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (scored.status !== 0) {
    console.error(scored.stderr || `score failed for ${variant}`);
    process.exit(2);
  }
  fs.writeFileSync(path.join(runDir, `${variant}-summary.json`), scored.stdout);
}

const compared = spawnSync(process.execPath, [
  path.join(root, "scripts", "compare.mjs"),
  path.join(runDir, "without-skill-summary.json"),
  path.join(runDir, "with-skill-summary.json")
], { encoding: "utf8" });
if (compared.status === 2) {
  console.error(compared.stderr || "comparison evidence is malformed");
  process.exit(2);
}
fs.writeFileSync(path.join(runDir, "comparison.json"), `${compared.stdout.trim()}\n`);
console.log(compared.stdout.trim());
process.exit(compared.status === 0 ? 0 : 1);
