import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  parseAdaptiveHarnessReceipt,
  verifyAdaptiveHarnessExpectation
} from "./adaptive-harness-receipt.mjs";
import { parseBenchmarkArgs } from "./benchmark-options.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "evals", "adaptive-harness.json");
const overlayPath = path.join(root, "evals", "adaptive-harness-candidate.md");
const skillPath = path.join(root, "skills", "loopspine", "SKILL.md");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const overlay = fs.readFileSync(overlayPath, "utf8");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const currentSkill = fs.readFileSync(skillPath);
const frozenSkillSha256 = "5f58a9f74a57569f3554e33d24508464ede7bb50589a5eb24e38073fe2d905a6";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const validReceiptText = [
  "Investigate the missing red gate, then continue under parent ownership.",
  "RED_GATE: missing-recover",
  "CONTRADICTIONS: none",
  "CHALLENGER: used \"the attempted stop needs an independent check\"",
  "RECOVERY: parent-owned",
  "REUSE: proposed-only \"eval: retain the red-capable regression\""
].join("\n");
const receipt = parseAdaptiveHarnessReceipt(validReceiptText);
assert.deepEqual(receipt, {
  red_gate: { state: "missing-recover", detail: null },
  contradictions: { state: "none", detail: null },
  challenger: { state: "used", detail: "the attempted stop needs an independent check" },
  recovery: { state: "parent-owned", detail: null },
  reuse: { state: "proposed-only", detail: "eval: retain the red-capable regression" }
});
assert.deepEqual(verifyAdaptiveHarnessExpectation(receipt, {
  red_gate: "missing-recover",
  contradictions: "none",
  recovery: "parent-owned",
  reuse: ["none", "proposed-only"]
}), []);
assert.match(verifyAdaptiveHarnessExpectation(receipt, { recovery: "user-owned" })[0], /recovery/);
assert.throws(() => parseAdaptiveHarnessReceipt(validReceiptText.replace("RECOVERY: parent-owned\n", "")), /missing RECOVERY/);
assert.throws(() => parseAdaptiveHarnessReceipt(`${validReceiptText}\nRECOVERY: parent-owned`), /duplicate RECOVERY/);
assert.throws(() => parseAdaptiveHarnessReceipt(validReceiptText.replace("CHALLENGER: used \"the attempted stop needs an independent check\"", "CHALLENGER: used")), /CHALLENGER/);
assert.throws(() => parseAdaptiveHarnessReceipt(validReceiptText.replace("CONTRADICTIONS: none\nCHALLENGER", "CHALLENGER: not-used \"no evidence-backed fix exists yet\"\nCONTRADICTIONS")), /ordered/);

assert.equal(fixture.suite, "loopspine-adaptive-harness-v1");
assert.deepEqual(fixture.cases.map(({ id }) => id), ["adaptive-df-03", "adaptive-df-08", "adaptive-fuzzy"]);
for (const item of fixture.cases) {
  assert.equal(item.receipt_contract, "adaptive-harness-v1");
  assert.ok(item.receipt_expectations);
}
for (const field of ["RED_GATE", "CONTRADICTIONS", "CHALLENGER", "RECOVERY", "REUSE"]) {
  assert.equal(overlay.split("\n").filter((line) => line.startsWith(`${field}:`)).length, 1);
}
for (const safeguard of ["cannot report completion", "parent-owned", "must not edit skills, instructions, or memory"]) {
  assert.ok(overlay.includes(safeguard));
}

assert.deepEqual(parseBenchmarkArgs([]), {
  pilot: false,
  sealed: false,
  sealedOnly: false,
  developmentFile: path.join("evals", "evals.json"),
  sealedFile: path.join("evals", "sealed-v2.json"),
  baselineSkillFile: null,
  candidateOverlayFile: null,
  requireStrictCases: [],
  candidateScoreFloor: null,
  samples: 3,
  seed: "loopspine-v2",
  model: process.env.LOOPSPINE_MODEL || "gpt-5.5"
});
const customOptions = parseBenchmarkArgs([
  "--development-file", "evals/adaptive-harness.json",
  "--baseline-skill-file", "skills/loopspine/SKILL.md",
  "--candidate-overlay-file", "evals/adaptive-harness-candidate.md",
  "--require-strict-cases", "adaptive-df-03,adaptive-df-08",
  "--candidate-score-floor", "0.9673",
  "--samples", "3",
  "--seed", "loopspine-adaptive-harness-v1"
]);
assert.deepEqual(customOptions.requireStrictCases, ["adaptive-df-03", "adaptive-df-08"]);
assert.equal(customOptions.developmentFile, "evals/adaptive-harness.json");
assert.equal(customOptions.candidateOverlayFile, "evals/adaptive-harness-candidate.md");
assert.equal(customOptions.candidateScoreFloor, 0.9673);
assert.throws(() => parseBenchmarkArgs(["--require-strict-cases", ""]), /Missing value/);
assert.throws(() => parseBenchmarkArgs(["--require-strict-cases", "--samples", "3"]), /Missing value/);
assert.throws(() => parseBenchmarkArgs(["--candidate-overlay-file", ""]), /Missing value/);
assert.throws(() => parseBenchmarkArgs(["--candidate-score-floor", "1.1"]), /score floor/);
assert.throws(() => parseBenchmarkArgs(["--sealed", "--sealed-only"]), /cannot be used together/);

assert.equal(sha256(currentSkill), frozenSkillSha256);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--development-file evals\/adaptive-harness\.json/);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--candidate-overlay-file evals\/adaptive-harness-candidate\.md/);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--baseline-skill-file skills\/loopspine\/SKILL\.md/);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--require-strict-cases adaptive-df-03,adaptive-df-08/);
assert.match(packageMetadata.scripts["benchmark:adaptive-harness"], /--samples 3/);
assert.match(packageMetadata.scripts["benchmark:sealed"], /--candidate-score-floor 0\.9673/);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "loopspine-adaptive-score-"));
try {
  const caseId = "adaptive-df-03";
  const outputDir = path.join(tempRoot, "with-skill", caseId);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "sample-1.txt"), [
    "ROUTE: investigate",
    "A red-capable failing command is missing, so recover and continue.",
    validReceiptText
  ].join("\n"));
  const provenance = {
    samples: 1,
    sealed: false,
    sealed_only: false,
    skill_sha256: sha256(currentSkill),
    baseline_skill: { path: "skills/loopspine/SKILL.md", sha256: sha256(currentSkill) },
    candidate_overlay: { path: "evals/adaptive-harness-candidate.md", sha256: sha256(overlay) },
    eval_files: [{ path: "evals/adaptive-harness.json", source: "development", sha256: sha256(fs.readFileSync(fixturePath)) }],
    cases: [{ id: caseId, split: "development", source: "development" }]
  };
  fs.writeFileSync(path.join(tempRoot, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
  const score = spawnSync(process.execPath, [path.join(root, "scripts", "score.mjs"), tempRoot, "with-skill", caseId, "--samples", "1"], { cwd: root, encoding: "utf8" });
  assert.equal(score.status, 0, score.stderr);
  const summary = JSON.parse(score.stdout);
  assert.equal(summary.results[0].strict_pass, true);
  assert.equal(summary.results[0].receipt_contract_passed, true);

  provenance.candidate_overlay.sha256 = "0".repeat(64);
  fs.writeFileSync(path.join(tempRoot, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
  const badOverlay = spawnSync(process.execPath, [path.join(root, "scripts", "score.mjs"), tempRoot, "with-skill", caseId, "--samples", "1"], { cwd: root, encoding: "utf8" });
  assert.notEqual(badOverlay.status, 0);
  assert.match(badOverlay.stderr, /candidate overlay hash/);

  provenance.candidate_overlay.sha256 = sha256(overlay);
  provenance.baseline_skill.sha256 = "0".repeat(64);
  fs.writeFileSync(path.join(tempRoot, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
  const badBaseline = spawnSync(process.execPath, [path.join(root, "scripts", "score.mjs"), tempRoot, "with-skill", caseId, "--samples", "1"], { cwd: root, encoding: "utf8" });
  assert.notEqual(badBaseline.status, 0);
  assert.match(badBaseline.stderr, /baseline skill hash/);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Adaptive harness contract tests passed: receipt, fixtures, options, provenance, and frozen baseline.");
