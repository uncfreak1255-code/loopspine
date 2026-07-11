import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

const codex = readJson(".codex-plugin/plugin.json");
const claude = readJson(".claude-plugin/plugin.json");
const evals = readJson("evals/evals.json");
const sealed = readJson("evals/sealed-v2.json");
const demoReceipt = readJson("demo/latest/receipt.json");
const dogfood = readJson("dogfood/register.json");
const skillPath = path.join(root, "skills", "loopspine", "SKILL.md");
const skill = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, "utf8") : "";

for (const manifest of [codex, claude].filter(Boolean)) {
  if (manifest.name !== "loopspine") errors.push("plugin manifest name must be loopspine");
  if (manifest.version !== "0.2.0") errors.push("plugin manifest version must be 0.2.0");
}
if (!skill.startsWith("---\nname: loopspine\n")) errors.push("SKILL.md frontmatter is missing or invalid");
if (!skill.includes("RED: write or select a focused test")) errors.push("SKILL.md is missing the TDD contract");
if (!skill.includes("Do not turn routine local file edits into user checkpoints")) errors.push("SKILL.md is missing local-autonomy guidance");
if (!skill.includes("RESULT: success | clean-no-op | no-progress")) errors.push("SKILL.md is missing terminal states");

const cases = evals?.cases || [];
const sealedCases = sealed?.cases || [];
const ids = new Set();
for (const item of cases) {
  if (!item.id || ids.has(item.id)) errors.push(`invalid or duplicate eval id: ${item.id || "<missing>"}`);
  ids.add(item.id);
  if (!["core", "development"].includes(item.split)) errors.push(`${item.id}: invalid development split`);
  if (!item.prompt || !item.routes?.length || !item.must_match?.length) errors.push(`${item.id}: incomplete eval contract`);
  for (const pattern of item.must_not_regex || []) {
    try { new RegExp(pattern, "i"); } catch { errors.push(`${item.id}: invalid regex ${pattern}`); }
  }
}
if (cases.length < 17) errors.push("eval pack must contain at least 17 cases");
for (const item of sealedCases) {
  if (!item.id || ids.has(item.id)) errors.push(`invalid or duplicate sealed eval id: ${item.id || "<missing>"}`);
  ids.add(item.id);
  if (item.split !== "held-out") errors.push(`${item.id}: sealed split must be held-out`);
  if (!item.prompt || !item.routes?.length || !item.must_match?.length) errors.push(`${item.id}: incomplete sealed eval contract`);
  for (const pattern of item.must_not_regex || []) {
    try { new RegExp(pattern, "i"); } catch { errors.push(`${item.id}: invalid regex ${pattern}`); }
  }
}
if (sealed?.suite !== "loopspine-sealed-v2") errors.push("sealed eval suite id is invalid");
if (sealed?.authored_by !== "independent-terra") errors.push("sealed eval author receipt is invalid");
if (sealedCases.length < 6) errors.push("sealed eval pack must contain at least six held-out cases");
if (demoReceipt?.success !== true || demoReceipt?.sawyer_interventions !== 0 || demoReceipt?.incorrect_stop !== false) {
  errors.push("demo receipt must prove success with zero interventions and no incorrect stop");
}
if (!demoReceipt?.phases || !Object.values(demoReceipt.phases).every((phase) => phase.passed === true)) {
  errors.push("demo receipt must pass every execution phase");
}
if (dogfood?.target_tasks !== 10 || dogfood?.tasks?.length !== 10) errors.push("dogfood register must contain ten target tasks");
const gifPath = path.join(root, "demo", "loopspine-demo.gif");
if (!fs.existsSync(gifPath) || !fs.readFileSync(gifPath).subarray(0, 6).toString().startsWith("GIF89")) {
  errors.push("demo GIF is missing or invalid");
}

for (const relativePath of ["README.md", "LICENSE", "docs/design.md", "docs/benchmark-method.md", "docs/benchmark-revisions.md", "docs/dogfood.md", "docs/integration.md"]) {
  if (!fs.existsSync(path.join(root, relativePath))) errors.push(`missing ${relativePath}`);
}

if (errors.length) {
  console.error(`LoopSpine validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`LoopSpine valid: 2 plugin manifests, 1 skill, ${cases.length} development cases, ${sealedCases.length} sealed held-out cases.`);
