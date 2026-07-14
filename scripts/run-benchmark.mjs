import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const variants = ["without-skill", "with-skill"];

function usage() {
  console.error("Usage: node run-benchmark.mjs [--pilot] [--sealed|--sealed-only] [--sealed-file PATH] [--baseline-skill-file PATH] [--samples N] [--seed VALUE] [--model NAME]");
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const options = { pilot: false, sealed: false, sealedOnly: false, sealedFile: path.join("evals", "sealed-v2.json"), baselineSkillFile: null, samples: null, seed: "loopspine-v2", model: process.env.LOOPSPINE_MODEL || "gpt-5.5" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      usage();
      process.exit(0);
    }
    if (arg === "--pilot") options.pilot = true;
    else if (arg === "--sealed") options.sealed = true;
    else if (arg === "--sealed-only") options.sealedOnly = true;
    else if (arg === "--samples" || arg === "--seed" || arg === "--model" || arg === "--sealed-file" || arg === "--baseline-skill-file") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`Missing value for ${arg}`);
      if (arg === "--samples") {
        if (!/^\d+$/.test(value) || Number(value) < 1) fail("--samples must be a positive integer");
        options.samples = Number(value);
      } else if (arg === "--seed") options.seed = value;
      else if (arg === "--sealed-file") options.sealedFile = value;
      else if (arg === "--baseline-skill-file") options.baselineSkillFile = value;
      else options.model = value;
      index += 1;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (options.sealed && options.sealedOnly) fail("--sealed and --sealed-only cannot be used together");
  if (options.pilot && options.sealedOnly) fail("--pilot and --sealed-only cannot be used together");
  options.samples ??= options.pilot ? 1 : 3;
  return options;
}

function readEvalFile(relativePath, source) {
  const filePath = path.join(root, relativePath);
  let raw;
  try {
    raw = fs.readFileSync(filePath);
  } catch (error) {
    fail(`Missing evaluation evidence: ${filePath}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    fail(`Malformed evaluation file: ${filePath}: ${error.message}`);
  }
  if (!Array.isArray(parsed.cases)) fail(`Malformed evaluation file: ${filePath} has no cases array`);
  return {
    source,
    relativePath,
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    cases: parsed.cases.map((item) => ({ ...item, source }))
  };
}

function createRandom(seed) {
  const hash = crypto.createHash("sha256").update(seed).digest();
  let state = hash.readUInt32LE(0);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function codexVersion() {
  const result = spawnSync("codex", ["--version"], { encoding: "utf8", timeout: 15000 });
  const version = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (result.error || result.status !== 0 || !version) {
    fail(`Missing execution evidence: unable to run codex --version: ${result.error?.message || version || `exit ${result.status}`}`);
  }
  return version;
}

const options = parseArgs(process.argv.slice(2));
const development = readEvalFile(path.join("evals", "evals.json"), "development");
const sealed = (options.sealed || options.sealedOnly) ? readEvalFile(options.sealedFile, "sealed") : null;
const pilotIds = new Set(["plan-fuzzy-cross-repo", "tdd-feature", "debug-red-capable-gate", "temporary-roles-without-ceremony", "bounded-loop", "heldout-docs-no-tdd"]);
const developmentCases = options.pilot ? development.cases.filter((item) => pilotIds.has(item.id)) : development.cases;
const cases = [
  ...(options.sealedOnly ? [] : developmentCases),
  ...(sealed ? sealed.cases : [])
];
const duplicateIds = cases.map((item) => item.id).filter((id, index, all) => all.indexOf(id) !== index);
if (duplicateIds.length) fail(`Malformed evaluation evidence: duplicate case ids: ${duplicateIds.join(", ")}`);
if (!cases.length) fail("Malformed evaluation evidence: no selected cases");

const skillPath = path.join(root, "skills", "loopspine", "SKILL.md");
let skill;
try {
  skill = fs.readFileSync(skillPath, "utf8");
} catch (error) {
  fail(`Missing execution evidence: ${skillPath}: ${error.message}`);
}
let baselineInstructions = "You are a capable senior coding agent. Choose a sensible workflow for the software task. Preserve ordinary safety boundaries and do not execute the scenario.";
let baselineSkillPath = null;
if (options.baselineSkillFile) {
  baselineSkillPath = path.isAbsolute(options.baselineSkillFile)
    ? options.baselineSkillFile
    : path.resolve(root, options.baselineSkillFile);
  try {
    baselineInstructions = fs.readFileSync(baselineSkillPath, "utf8");
  } catch (error) {
    fail(`Missing baseline skill evidence: ${baselineSkillPath}: ${error.message}`);
  }
}

const startedAt = new Date().toISOString();
const stamp = startedAt.replace(/[:.]/g, "-");
const runDir = path.join(root, "results", `${stamp}-${options.model.replace(/[^a-zA-Z0-9_.-]/g, "-")}${options.pilot ? "-pilot" : ""}${options.sealed ? "-sealed" : ""}${options.sealedOnly ? "-sealed-only" : ""}`);
fs.mkdirSync(runDir, { recursive: true });

const provenance = {
  model: options.model,
  codex_version: codexVersion(),
  timestamp_utc: startedAt,
  seed: options.seed,
  samples: options.samples,
  pilot: options.pilot,
  sealed: options.sealed || options.sealedOnly,
  sealed_only: options.sealedOnly,
  skill_sha256: hashFile(skillPath),
  baseline_skill: baselineSkillPath ? { path: baselineSkillPath, sha256: hashFile(baselineSkillPath) } : null,
  eval_files: [development, ...(sealed ? [sealed] : [])].map(({ relativePath, sha256, source }) => ({ path: relativePath, source, sha256 })),
  command_args: process.argv.slice(2),
  reasoning_effort: process.env.LOOPSPINE_REASONING_EFFORT || "provider-default",
  temperature: "provider-default-not-configurable-by-runner",
  platform: {
    platform: process.platform,
    release: os.release(),
    arch: process.arch,
    node: process.version
  },
  cases: cases.map(({ id, split, source }) => ({ id, split, source }))
};
fs.writeFileSync(path.join(runDir, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);

const timings = [];
const random = createRandom(options.seed);

for (const item of cases) {
  for (let sample = 1; sample <= options.samples; sample += 1) {
    const executionOrder = shuffle(variants, random);
    for (const variant of executionOrder) {
      const outputDir = path.join(runDir, variant, item.id);
      const outputPath = path.join(outputDir, `sample-${sample}.txt`);
      fs.mkdirSync(outputDir, { recursive: true });
      const instructions = variant === "with-skill" ? skill : baselineInstructions;
      const prompt = `${instructions}\n\n# Scenario\n${item.prompt}\n\nExplain the workflow you would follow. Do not execute commands or edit files.`;
      const started = Date.now();
      console.log(`[${variant}] ${item.id} sample ${sample}/${options.samples}`);
      const result = spawnSync("codex", [
        "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral",
        "--skip-git-repo-check", "--sandbox", "read-only", "--model", options.model,
        "--cd", root, "--output-last-message", outputPath, "-"
      ], { input: prompt, encoding: "utf8", timeout: 180000, stdio: ["pipe", "pipe", "pipe"] });
      const durationMs = Date.now() - started;
      if (result.error || result.status !== 0 || !fs.existsSync(outputPath)) {
        fail(`Missing execution evidence for ${variant}/${item.id}/sample-${sample}: ${result.error?.message || (result.stderr || "").slice(-2000) || `codex exit ${result.status}`}`);
      }
      timings.push({ variant, id: item.id, split: item.split, source: item.source, sample, execution_order: executionOrder, duration_ms: durationMs, output_bytes: fs.statSync(outputPath).size });
    }
  }
}

const caseArg = cases.map((item) => item.id).join(",");
for (const variant of variants) {
  const scoreArgs = [path.join(root, "scripts", "score.mjs"), runDir, variant, caseArg, "--samples", String(options.samples)];
  if (options.sealed) scoreArgs.push("--sealed");
  if (options.sealedOnly) scoreArgs.push("--sealed-only");
  const scored = spawnSync(process.execPath, scoreArgs, { encoding: "utf8" });
  if (scored.status !== 0) fail(`Missing scoring evidence for ${variant}: ${scored.stderr || `score exit ${scored.status}`}`);
  fs.writeFileSync(path.join(runDir, `${variant}-summary.json`), scored.stdout);
}
fs.writeFileSync(path.join(runDir, "timings.json"), `${JSON.stringify({ model: options.model, seed: options.seed, samples: options.samples, pilot: options.pilot, sealed: options.sealed || options.sealedOnly, sealed_only: options.sealedOnly, cases: cases.length, timings }, null, 2)}\n`);

const compared = spawnSync(process.execPath, [
  path.join(root, "scripts", "compare.mjs"),
  path.join(runDir, "without-skill-summary.json"),
  path.join(runDir, "with-skill-summary.json")
], { encoding: "utf8" });
if (compared.status === 2) fail(`Malformed comparison evidence: ${compared.stderr || "compare exit 2"}`);
fs.writeFileSync(path.join(runDir, "comparison.json"), `${compared.stdout.trim()}\n`);
console.log(`Run: ${runDir}`);
console.log(compared.stdout.trim());
process.exit(compared.status === 0 ? 0 : 1);
