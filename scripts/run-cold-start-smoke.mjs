import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  coldStartResponseSchema,
  verifyColdStartResponse,
  verifyColdStartTrace
} from "./cold-start-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const model = process.env.LOOPSPINE_MODEL || "gpt-5.5";
const timeout = Number(process.env.LOOPSPINE_COLD_START_TIMEOUT || 180000);

function run(command, args, commandTimeout = timeout) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: commandTimeout,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function requireRun(result, label) {
  if (result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || `exit ${result.status}`;
    throw new Error(`${label} failed: ${String(detail).trim()}`);
  }
  return result.stdout.trim();
}

function fail(message, receiptPath = null) {
  console.error(`Cold-start smoke: FAIL\nCause: ${message}`);
  if (receiptPath) console.error(`Receipt: ${receiptPath}`);
  process.exit(1);
}

if (!Number.isSafeInteger(timeout) || timeout < 1000) {
  fail("LOOPSPINE_COLD_START_TIMEOUT must be an integer >= 1000.");
}

const startedAt = new Date().toISOString();
const resultDir = path.join(root, "results", "cold-start", startedAt.replace(/[:.]/g, "-"));
fs.mkdirSync(resultDir, { recursive: true });
const schemaPath = path.join(resultDir, "response-schema.json");
const responsePath = path.join(resultDir, "response.json");
const receiptPath = path.join(resultDir, "receipt.json");
fs.writeFileSync(schemaPath, `${JSON.stringify(coldStartResponseSchema, null, 2)}\n`);

let sourceCommit;
let codexVersion;
try {
  sourceCommit = requireRun(run("git", ["rev-parse", "HEAD"], 15000), "Git source readback");
  codexVersion = requireRun(run("codex", ["--version"], 15000), "Codex version readback");
} catch (error) {
  fail(error.message, receiptPath);
}

const statusBefore = run("git", ["status", "--porcelain"], 15000);
const prompt = [
  "Continue LoopSpine from source truth.",
  "This is a cold-start readback: use only current Git state and files inside this repository.",
  "Do not rely on prior sessions, chat history, saved checkpoints, or external memory.",
  "Begin by reading AGENTS.md, then follow its restart instructions.",
  "Identify the exact current HEAD commit, frozen comparison baseline, promotion decision, first unfinished task, complete candidate proof commands, protected-branch boundary, and repository files that prove the answer.",
  "Do not edit files. Return only the structured response requested by the output schema."
].join(" ");

const execution = run("codex", [
  "exec",
  "--ignore-user-config",
  "--ignore-rules",
  "--ephemeral",
  "--sandbox", "read-only",
  "--model", model,
  "--cd", root,
  "--output-schema", schemaPath,
  "--output-last-message", responsePath,
  "--json",
  prompt
]);
fs.writeFileSync(path.join(resultDir, "events.jsonl"), execution.stdout || "");
fs.writeFileSync(path.join(resultDir, "stderr.txt"), execution.stderr || "");

const errors = [];
let response = null;
let contractAssertions = null;
let traceAssertions = null;
if (execution.status !== 0) {
  const detail = execution.error?.code === "ETIMEDOUT"
    ? `timed out after ${timeout}ms`
    : (execution.stderr || execution.stdout || `exit ${execution.status}`).trim();
  errors.push(`Codex execution failed: ${detail}`);
}
try {
  response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
  contractAssertions = verifyColdStartResponse(response, { expectedSourceCommit: sourceCommit });
} catch (error) {
  errors.push(`response verification failed: ${error.message}`);
}
try {
  traceAssertions = verifyColdStartTrace(execution.stdout || "");
} catch (error) {
  errors.push(`trace verification failed: ${error.message}`);
}

const statusAfter = run("git", ["status", "--porcelain"], 15000);
const assertions = {
  codex_exit_zero: execution.status === 0,
  codex_not_timed_out: execution.error?.code !== "ETIMEDOUT",
  repository_unchanged: statusBefore.status === 0
    && statusAfter.status === 0
    && statusAfter.stdout === statusBefore.stdout,
  ...contractAssertions,
  ...traceAssertions
};
const passed = errors.length === 0 && Object.values(assertions).every(Boolean);
const receipt = {
  schema_version: 1,
  smoke: "cold-start-continuity",
  claim: "An ephemeral read-only Codex session recovered LoopSpine's current source, frozen baseline, rejected promotion, next task, proof gate, and branch boundary from repository truth.",
  limitations: [
    "This proves repository continuity, not candidate task quality.",
    "This does not authorize skill changes, global installation, hooks, merge, or deploy.",
    "A session checkpoint may add temporary detail but remains subordinate to repository truth."
  ],
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  codex_version: codexVersion,
  model,
  source_commit: sourceCommit,
  prompt,
  response,
  assertions,
  errors,
  passed,
  host: os.platform()
};
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

if (!passed) fail(errors.join("; ") || "one or more assertions failed", receiptPath);

console.log("Cold-start smoke: PASS");
console.log(`Source: ${sourceCommit}`);
console.log("Recovered: rejected promotion, adaptive-harness receipt eval, full proof gate, and protected-main boundary.");
console.log("Isolation: ephemeral read-only Codex session; repository unchanged.");
console.log(`Receipt: ${receiptPath}`);
