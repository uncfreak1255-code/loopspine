import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAdaptiveHarnessReceipt, verifyAdaptiveHarnessExpectation } from "./adaptive-harness-receipt.mjs";
import { hasAffirmativeForbiddenPhrase, matchesRoute } from "./matching.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.error("Usage: node score.mjs <run-dir> <without-skill|with-skill> [case-ids] [--sealed|--sealed-only] [--samples N]");
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(argv) {
  const [runDir, variant, ...rest] = argv;
  if (!runDir || !["without-skill", "with-skill"].includes(variant)) {
    usage();
    process.exit(2);
  }
  const options = { runDir: path.resolve(runDir), variant, caseArg: null, mode: null, samples: null };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--sealed") {
      if (options.mode) fail("--sealed and --sealed-only cannot be used together");
      options.mode = "with-sealed";
    } else if (arg === "--sealed-only") {
      if (options.mode) fail("--sealed and --sealed-only cannot be used together");
      options.mode = "sealed-only";
    } else if (arg === "--samples") {
      const value = rest[index + 1];
      if (!value || !/^\d+$/.test(value) || Number(value) < 1) fail("--samples must be a positive integer");
      options.samples = Number(value);
      index += 1;
    } else if (!arg.startsWith("--") && options.caseArg === null) options.caseArg = arg;
    else fail(`Unknown argument: ${arg}`);
  }
  return options;
}

function readJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`Missing ${label}: ${filePath}: ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`Malformed ${label}: ${filePath}: ${error.message}`);
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function evidencePath(relativePath, label) {
  if (!relativePath || path.isAbsolute(relativePath)) fail(`Malformed ${label}: path must be repository-relative`);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) fail(`Malformed ${label}: path escapes repository`);
  return resolved;
}

function loadCases(relativePath, source) {
  const data = readJson(path.join(root, relativePath), "evaluation file");
  if (!Array.isArray(data.cases)) fail(`Malformed evaluation file: ${relativePath} has no cases array`);
  return data.cases.map((item) => {
    if (!item.id || !item.split || !Array.isArray(item.routes) || !Array.isArray(item.must_match) || !Array.isArray(item.must_not_match)) {
      fail(`Malformed evaluation case in ${relativePath}`);
    }
    return { ...item, source };
  });
}

function scoreOutput(item, output) {
  const failures = [];
  let earned = 0;
  const regexes = item.must_not_regex || [];
  const receiptPoints = item.receipt_contract === "adaptive-harness-v1" ? 5 : 0;
  const maximum = 2 + item.must_match.length + item.must_not_match.length + regexes.length + receiptPoints;
  const normalized = output.toLowerCase();
  if (matchesRoute(output, item.routes)) earned += 2;
  else failures.push(`wrong route: expected ${item.routes.join(" | ")}`);
  for (const group of item.must_match) {
    if (!Array.isArray(group)) fail(`Malformed evaluation case ${item.id}: must_match group is not an array`);
    if (group.some((term) => normalized.includes(term.toLowerCase()))) earned += 1;
    else failures.push(`missing: ${group.join(" | ")}`);
  }
  for (const forbidden of item.must_not_match) {
    if (!hasAffirmativeForbiddenPhrase(output, forbidden)) earned += 1;
    else failures.push(`forbidden: ${forbidden}`);
  }
  for (const pattern of regexes) {
    let regex;
    try {
      regex = new RegExp(pattern, "i");
    } catch (error) {
      fail(`Malformed evaluation case ${item.id}: invalid regex ${pattern}: ${error.message}`);
    }
    if (!regex.test(output)) earned += 1;
    else failures.push(`forbidden regex: ${pattern}`);
  }
  let receiptContractPassed = null;
  if (item.receipt_contract === "adaptive-harness-v1") {
    try {
      const receipt = parseAdaptiveHarnessReceipt(output);
      const receiptFailures = verifyAdaptiveHarnessExpectation(receipt, item.receipt_expectations);
      earned += Math.max(0, receiptPoints - receiptFailures.length);
      failures.push(...receiptFailures.map((failure) => `receipt: ${failure}`));
      receiptContractPassed = receiptFailures.length === 0;
    } catch (error) {
      failures.push(`receipt: ${error.message}`);
      receiptContractPassed = false;
    }
  }
  return { earned, maximum, strict_pass: failures.length === 0, failures, receipt_contract_passed: receiptContractPassed };
}

function sampleFiles(caseDir, expectedSamples, requireExactCount) {
  let entries;
  try {
    entries = fs.readdirSync(caseDir, { withFileTypes: true });
  } catch (error) {
    fail(`Missing sample evidence: ${caseDir}: ${error.message}`);
  }
  const samples = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = /^sample-(\d+)\.txt$/.exec(entry.name);
    if (!match) continue;
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number) || number < 1 || samples.has(number)) fail(`Malformed sample evidence: ${path.join(caseDir, entry.name)}`);
    samples.set(number, entry.name);
  }
  for (let sample = 1; sample <= expectedSamples; sample += 1) {
    if (!samples.has(sample)) fail(`Missing sample evidence: ${path.join(caseDir, `sample-${sample}.txt`)}`);
  }
  if (requireExactCount && samples.size !== expectedSamples) {
    fail(`Malformed sample evidence: ${caseDir} has ${samples.size} samples; expected exactly ${expectedSamples}`);
  }
  return samples;
}

const options = parseArgs(process.argv.slice(2));
const provenancePath = path.join(options.runDir, "provenance.json");
const provenance = fs.existsSync(provenancePath) ? readJson(provenancePath, "provenance") : null;
if (provenance && (typeof provenance.sealed !== "boolean" || (provenance.sealed_only !== undefined && typeof provenance.sealed_only !== "boolean"))) {
  fail("Malformed provenance: sealed mode is invalid");
}
const provenanceMode = provenance?.sealed_only ? "sealed-only" : provenance?.sealed ? "with-sealed" : "development";
const mode = options.mode ?? provenanceMode;
if (provenance && mode !== provenanceMode) fail("Malformed evidence: sealed mode does not match provenance.json");
const samples = options.samples ?? provenance?.samples ?? 1;
if (!Number.isSafeInteger(samples) || samples < 1) fail("Malformed evidence: sample count is not a positive integer");
if (provenance?.samples !== undefined && provenance.samples !== samples) fail("Malformed evidence: --samples does not match provenance.json");
if (provenance) {
  const skillPath = path.join(root, "skills", "loopspine", "SKILL.md");
  if (sha256(skillPath) !== provenance.skill_sha256) fail("Malformed evidence: skill hash does not match provenance.json");
  if (!Array.isArray(provenance.eval_files)) fail("Malformed provenance: eval file hashes are missing");
  for (const item of provenance.eval_files) {
    const evalPath = evidencePath(item.path, "evaluation provenance");
    if (!item.path || !item.sha256 || !fs.existsSync(evalPath) || sha256(evalPath) !== item.sha256) {
      fail(`Malformed evidence: eval hash does not match provenance.json for ${item.path || "<missing>"}`);
    }
  }
  if (provenance.candidate_overlay) {
    const overlayPath = evidencePath(provenance.candidate_overlay.path, "candidate overlay provenance");
    if (!provenance.candidate_overlay.sha256 || !fs.existsSync(overlayPath) || sha256(overlayPath) !== provenance.candidate_overlay.sha256) {
      fail("Malformed evidence: candidate overlay hash does not match provenance.json");
    }
  }
  if (provenance.baseline_skill) {
    const baselinePath = evidencePath(provenance.baseline_skill.path, "baseline skill provenance");
    if (!provenance.baseline_skill.sha256 || !fs.existsSync(baselinePath) || sha256(baselinePath) !== provenance.baseline_skill.sha256) {
      fail("Malformed evidence: baseline skill hash does not match provenance.json");
    }
  }
}

const developmentRelativePath = provenance?.eval_files?.find((item) => item.source === "development")?.path
  || path.join("evals", "evals.json");
const sealedRelativePath = provenance?.eval_files?.find((item) => item.source === "sealed")?.path
  || path.join("evals", "sealed-v1.json");

const cases = [
  ...(mode === "sealed-only" ? [] : loadCases(developmentRelativePath, "development")),
  ...(mode === "development" ? [] : loadCases(sealedRelativePath, "sealed"))
];
const selectedIds = options.caseArg ? new Set(options.caseArg.split(",").filter(Boolean)) : null;
const selectedCases = selectedIds ? cases.filter((item) => selectedIds.has(item.id)) : cases;
if (!selectedCases.length || (selectedIds && selectedCases.length !== selectedIds.size)) fail("Malformed evidence: selected evaluation cases are missing");
if (new Set(selectedCases.map((item) => item.id)).size !== selectedCases.length) fail("Malformed evidence: duplicate selected case ids");
if (provenance) {
  const expectedCases = selectedCases.map(({ id, split, source }) => ({ id, split, source }));
  if (JSON.stringify(expectedCases) !== JSON.stringify(provenance.cases)) {
    fail("Malformed evidence: selected cases do not match provenance.json");
  }
}

const results = [];
const caseSampleCounts = {};
for (const item of selectedCases) {
  const caseDir = path.join(options.runDir, options.variant, item.id);
  const samplesForCase = sampleFiles(caseDir, samples, mode !== "development");
  caseSampleCounts[item.id] = samplesForCase.size;
  for (let sample = 1; sample <= samples; sample += 1) {
    const outputPath = path.join(caseDir, samplesForCase.get(sample));
    let output;
    try {
      output = fs.readFileSync(outputPath, "utf8");
    } catch (error) {
      fail(`Missing sample evidence: ${outputPath}: ${error.message}`);
    }
    const scored = scoreOutput(item, output);
    results.push({ id: item.id, split: item.split, source: item.source, sample, ...scored });
  }
}

function totals(items) {
  const earned = items.reduce((sum, item) => sum + item.earned, 0);
  const maximum = items.reduce((sum, item) => sum + item.maximum, 0);
  const strictPasses = items.filter((item) => item.strict_pass).length;
  return {
    samples: items.length,
    strict_sample_passes: strictPasses,
    strict_sample_pass_rate: items.length ? Number((strictPasses / items.length).toFixed(4)) : null,
    earned,
    maximum,
    weighted_score: maximum ? Number((earned / maximum).toFixed(4)) : null
  };
}

const allTotals = totals(results);
const splitScores = Object.fromEntries([...new Set(results.map((item) => item.split))].sort().map((split) => [split, totals(results.filter((item) => item.split === split))]));
const sealedTotals = totals(results.filter((item) => item.source === "sealed"));
const boundaryViolations = results.flatMap((item) => item.failures.filter((failure) => failure.startsWith("forbidden")).map((failure) => ({ id: item.id, split: item.split, source: item.source, sample: item.sample, failure })));
const heldOut = splitScores["held-out"];
const summary = {
  variant: options.variant,
  sealed: mode !== "development",
  sealed_only: mode === "sealed-only",
  requested_samples: samples,
  cases: selectedCases.length,
  sample_count: results.length,
  strict_sample_passes: allTotals.strict_sample_passes,
  strict_sample_pass_rate: allTotals.strict_sample_pass_rate,
  weighted_score: allTotals.weighted_score,
  split_scores: splitScores,
  held_out_score: heldOut?.weighted_score ?? null,
  sealed_score: sealedTotals.weighted_score,
  boundary_violations: boundaryViolations.length,
  forbidden_boundary_violations: boundaryViolations,
  earned: allTotals.earned,
  maximum: allTotals.maximum,
  case_sample_counts: caseSampleCounts,
  results
};
console.log(JSON.stringify(summary, null, 2));
