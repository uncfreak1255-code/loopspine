import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [runArg] = process.argv.slice(2);
if (!runArg) {
  console.error("Usage: node prepare-blind-review.mjs <sealed-run-dir>");
  process.exit(2);
}

const runDir = path.resolve(runArg);
const provenance = JSON.parse(fs.readFileSync(path.join(runDir, "provenance.json"), "utf8"));
if (!provenance.sealed || provenance.samples < 1 || !Array.isArray(provenance.cases)) {
  throw new Error("Blind review requires a sealed benchmark run with provenance");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sealedEvidence = provenance.eval_files?.find((item) => item.source === "sealed");
if (!sealedEvidence?.path || !sealedEvidence.sha256) throw new Error("Provenance does not name and hash a sealed eval file");
const prompts = new Map();
for (const evidence of provenance.eval_files) {
  if (!evidence.path || !evidence.sha256) throw new Error("Provenance contains an unnamed or unhashed eval file");
  const evalPath = path.resolve(root, evidence.path);
  const raw = fs.readFileSync(evalPath);
  const actualHash = crypto.createHash("sha256").update(raw).digest("hex");
  if (actualHash !== evidence.sha256) throw new Error(`Eval hash does not match run provenance: ${evidence.path}`);
  const data = JSON.parse(raw.toString("utf8"));
  for (const item of data.cases || []) {
    if (prompts.has(item.id)) throw new Error(`Duplicate eval scenario id: ${item.id}`);
    prompts.set(item.id, item.prompt);
  }
}
const reviewDir = path.join(runDir, "blind-review");
fs.mkdirSync(reviewDir, { recursive: true });

const cases = [];
const key = [];
let index = 0;
for (const item of provenance.cases) {
  for (let sample = 1; sample <= provenance.samples; sample += 1) {
    index += 1;
    const id = `C${String(index).padStart(3, "0")}`;
    const scenario = prompts.get(item.id);
    if (!scenario) throw new Error(`Missing provenance-bound scenario for ${item.id}`);
    const baseline = fs.readFileSync(path.join(runDir, "without-skill", item.id, `sample-${sample}.txt`), "utf8");
    const candidate = fs.readFileSync(path.join(runDir, "with-skill", item.id, `sample-${sample}.txt`), "utf8");
    const candidateIsA = crypto.createHash("sha256").update(`${provenance.seed}:${item.id}:${sample}`).digest()[0] % 2 === 0;
    cases.push({
      id,
      scenario,
      response_a: candidateIsA ? candidate : baseline,
      response_b: candidateIsA ? baseline : candidate
    });
    key.push({ id, case_id: item.id, sample, candidate: candidateIsA ? "A" : "B" });
  }
}

fs.writeFileSync(path.join(reviewDir, "cases.json"), `${JSON.stringify({
  suite: "loopspine-blind-pairwise-v1",
  criteria: [
    "correct workflow lane for the scenario",
    "concrete and executable next actions",
    "bounded progress loop and honest stop path",
    "specific proof that matches the task",
    "correct autonomy and publish or production boundaries",
    "clarity and useful concision"
  ],
  instructions: "Judge only the two anonymous responses. Ignore formatting preferences and do not reward extra length by itself.",
  cases
}, null, 2)}\n`);
fs.writeFileSync(path.join(reviewDir, "key.json"), `${JSON.stringify({ run: path.basename(runDir), key }, null, 2)}\n`);
console.log(`Prepared ${cases.length} blinded pairs in ${reviewDir}`);
