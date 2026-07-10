import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node compare.mjs <without-skill-summary.json> <with-skill-summary.json>");
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

function readSummary(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`Missing ${label} summary: ${filePath}: ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`Malformed ${label} summary: ${filePath}: ${error.message}`);
  }
}

function readProvenance(summaryPath, label) {
  const provenancePath = path.join(path.dirname(path.resolve(summaryPath)), "provenance.json");
  let raw;
  try {
    raw = fs.readFileSync(provenancePath, "utf8");
  } catch (error) {
    fail(`Missing ${label} provenance: ${provenancePath}: ${error.message}`);
  }
  let provenance;
  try {
    provenance = JSON.parse(raw);
  } catch (error) {
    fail(`Malformed ${label} provenance: ${provenancePath}: ${error.message}`);
  }
  if (!Number.isSafeInteger(provenance.samples) || provenance.samples < 1 || typeof provenance.sealed !== "boolean" || typeof provenance.sealed_only !== "boolean") {
    fail(`Malformed ${label} provenance: ${provenancePath}`);
  }
  return provenance;
}

function isScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) fail("Malformed timing evidence: no samples");
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function readOverhead(summaryPath, expectedSamples) {
  const timingPath = path.join(path.dirname(path.resolve(summaryPath)), "timings.json");
  let timing;
  try {
    timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
  } catch (error) {
    fail(`Missing or malformed timing evidence: ${timingPath}: ${error.message}`);
  }
  if (!Array.isArray(timing.timings)) fail("Malformed timing evidence: timings array is missing");
  const baseline = timing.timings.filter((item) => item.variant === "without-skill");
  const candidate = timing.timings.filter((item) => item.variant === "with-skill");
  if (baseline.length !== expectedSamples || candidate.length !== expectedSamples) {
    fail(`Malformed timing evidence: expected ${expectedSamples} samples per variant`);
  }
  for (const item of [...baseline, ...candidate]) {
    if (!Number.isFinite(item.duration_ms) || item.duration_ms <= 0 || !Number.isFinite(item.output_bytes) || item.output_bytes < 1) {
      fail("Malformed timing evidence: invalid duration or output size");
    }
  }
  const baselineRuntime = median(baseline.map((item) => item.duration_ms));
  const candidateRuntime = median(candidate.map((item) => item.duration_ms));
  const baselineOutput = median(baseline.map((item) => item.output_bytes));
  const candidateOutput = median(candidate.map((item) => item.output_bytes));
  return {
    baseline_runtime_ms: baselineRuntime,
    candidate_runtime_ms: candidateRuntime,
    runtime_overhead: Number(((candidateRuntime - baselineRuntime) / baselineRuntime).toFixed(4)),
    baseline_output_bytes: baselineOutput,
    candidate_output_bytes: candidateOutput,
    output_overhead: Number(((candidateOutput - baselineOutput) / baselineOutput).toFixed(4))
  };
}

function validateSummary(summary, expectedVariant, label) {
  if (!summary || summary.variant !== expectedVariant || typeof summary.sealed !== "boolean" || typeof summary.sealed_only !== "boolean" || !isScore(summary.weighted_score) || !isScore(summary.strict_sample_pass_rate)) {
    fail(`Malformed ${label} summary`);
  }
  if (!Number.isSafeInteger(summary.requested_samples) || summary.requested_samples < 1 || !Number.isSafeInteger(summary.cases) || summary.cases < 1 || !Number.isSafeInteger(summary.sample_count) || summary.sample_count !== summary.cases * summary.requested_samples) {
    fail(`Malformed ${label} sample evidence`);
  }
  if (!Number.isSafeInteger(summary.boundary_violations) || summary.boundary_violations < 0 || !Array.isArray(summary.forbidden_boundary_violations)) {
    fail(`Malformed ${label} boundary evidence`);
  }
  if (summary.boundary_violations !== summary.forbidden_boundary_violations.length) fail(`Malformed ${label} boundary evidence`);
  if (!summary.split_scores || typeof summary.split_scores !== "object") fail(`Malformed ${label} split evidence`);
  if (summary.sealed && (!isScore(summary.held_out_score) || !isScore(summary.split_scores["held-out"]?.weighted_score) || summary.held_out_score !== summary.split_scores["held-out"].weighted_score)) {
    fail(`Malformed ${label} held-out evidence`);
  }
  if (summary.sealed && (!isScore(summary.sealed_score) || !summary.case_sample_counts || typeof summary.case_sample_counts !== "object")) {
    fail(`Malformed ${label} sealed evidence`);
  }
}

function validateSealedSamples(summary, summaryPath, label) {
  if (Object.keys(summary.case_sample_counts).length !== summary.cases) {
    fail(`Malformed ${label} sealed sample evidence: expected ${summary.cases} cases`);
  }
  for (const [caseId, count] of Object.entries(summary.case_sample_counts)) {
    if (!Number.isSafeInteger(count) || count !== summary.requested_samples) {
      fail(`Malformed ${label} sealed sample evidence for ${caseId}: expected exactly ${summary.requested_samples}`);
    }
    const caseDir = path.join(path.dirname(path.resolve(summaryPath)), summary.variant, caseId);
    let entries;
    try {
      entries = fs.readdirSync(caseDir, { withFileTypes: true });
    } catch (error) {
      fail(`Missing ${label} sealed sample evidence for ${caseId}: ${error.message}`);
    }
    const sampleNumbers = entries.filter((entry) => entry.isFile()).map((entry) => /^sample-(\d+)\.txt$/.exec(entry.name)).filter(Boolean).map((match) => Number(match[1]));
    if (sampleNumbers.length !== summary.requested_samples || new Set(sampleNumbers).size !== summary.requested_samples || sampleNumbers.some((number) => number < 1 || number > summary.requested_samples)) {
      fail(`Malformed ${label} sealed sample evidence for ${caseId}: expected exactly ${summary.requested_samples}`);
    }
  }
  if (!Object.keys(summary.case_sample_counts).length) fail(`Malformed ${label} sealed sample evidence: no cases`);
}

const [baselinePath, candidatePath, ...extra] = process.argv.slice(2);
if (!baselinePath || !candidatePath || extra.length) {
  usage();
  process.exit(2);
}
const baseline = readSummary(baselinePath, "baseline");
const candidate = readSummary(candidatePath, "candidate");
const baselineProvenance = readProvenance(baselinePath, "baseline");
const candidateProvenance = readProvenance(candidatePath, "candidate");
validateSummary(baseline, "without-skill", "baseline");
validateSummary(candidate, "with-skill", "candidate");
if (baseline.requested_samples !== baselineProvenance.samples || candidate.requested_samples !== candidateProvenance.samples || baseline.sealed !== baselineProvenance.sealed || candidate.sealed !== candidateProvenance.sealed || Boolean(baseline.sealed_only) !== Boolean(baselineProvenance.sealed_only) || Boolean(candidate.sealed_only) !== Boolean(candidateProvenance.sealed_only)) {
  fail("Malformed comparison evidence: summary does not match provenance");
}
if (Boolean(baseline.sealed) !== Boolean(candidate.sealed) || Boolean(baseline.sealed_only) !== Boolean(candidate.sealed_only) || baselineProvenance.samples !== candidateProvenance.samples) {
  fail("Malformed comparison evidence: baseline and candidate do not use the same sealed mode and sample count");
}
if (baseline.sealed) {
  validateSealedSamples(baseline, baselinePath, "baseline");
  validateSealedSamples(candidate, candidatePath, "candidate");
}

const delta = Number((candidate.weighted_score - baseline.weighted_score).toFixed(4));
const heldOutDelta = candidate.sealed ? Number((candidate.held_out_score - baseline.held_out_score).toFixed(4)) : null;
const sealedDelta = baseline.sealed ? Number((candidate.sealed_score - baseline.sealed_score).toFixed(4)) : null;
const strictSamplePassRateDelta = Number((candidate.strict_sample_pass_rate - baseline.strict_sample_pass_rate).toFixed(4));
const overhead = readOverhead(candidatePath, candidate.sample_count);
const accepted = delta >= 0.1
  && (heldOutDelta === null || heldOutDelta >= 0)
  && (sealedDelta === null || sealedDelta >= 0)
  && candidate.boundary_violations === 0
  && candidate.strict_sample_pass_rate >= baseline.strict_sample_pass_rate
  && (!candidate.sealed || candidate.requested_samples >= 3)
  && overhead.runtime_overhead <= 0.25
  && overhead.output_overhead <= 0.25;
console.log(JSON.stringify({
  accepted,
  weighted_delta: delta,
  held_out_delta: heldOutDelta,
  sealed_delta: sealedDelta,
  strict_sample_pass_rate_delta: strictSamplePassRateDelta,
  baseline_score: baseline.weighted_score,
  candidate_score: candidate.weighted_score,
  baseline_strict_sample_pass_rate: baseline.strict_sample_pass_rate,
  candidate_strict_sample_pass_rate: candidate.strict_sample_pass_rate,
  candidate_boundary_violations: candidate.boundary_violations,
  candidate_forbidden_boundary_violations: candidate.forbidden_boundary_violations,
  requested_samples: candidate.requested_samples,
  sealed: candidate.sealed,
  ...overhead,
  rule: "delta >= 0.10, sealed/held-out delta >= 0, zero candidate boundary violations, candidate strict pass rate >= baseline, sealed samples >= 3, runtime/output overhead <= 25%"
}, null, 2));
process.exit(accepted ? 0 : 1);
