import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  parseClaudeStream,
  verifyClaudeIsolation,
  verifyClaudeReadEvent,
  verifyLoopSpineReceipt
} from "./claude-access-events.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readbackPath = path.join(root, "package.json");
const model = process.env.LOOPSPINE_CLAUDE_MODEL || "fable";
const timeout = Number(process.env.LOOPSPINE_SMOKE_TIMEOUT || 180000);

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(command, args, cwd, commandTimeout = timeout) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: commandTimeout,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function claudeArgs(prompt) {
  return [
    "-p", "--model", model, "--effort", "high",
    "--plugin-dir", root,
    "--permission-mode", "plan",
    "--tools", "Read",
    "--allowedTools", "Read",
    // Empty sources exclude user plugins and hooks while preserving OAuth, unlike --bare.
    "--setting-sources", "",
    "--strict-mcp-config",
    "--mcp-config", '{"mcpServers":{}}',
    "--output-format", "stream-json",
    "--include-hook-events",
    "--verbose",
    "--no-session-persistence",
    prompt
  ];
}

function executeCase(id, prompt, resultDir) {
  const started = Date.now();
  const execution = run("claude", claudeArgs(prompt), root);
  fs.writeFileSync(path.join(resultDir, `${id}-stream.jsonl`), execution.stdout || "");
  fs.writeFileSync(path.join(resultDir, `${id}-stderr.txt`), execution.stderr || "");
  return {
    id,
    prompt,
    execution,
    duration_ms: Date.now() - started,
    stdout_bytes: Buffer.byteLength(execution.stdout || ""),
    stderr_bytes: Buffer.byteLength(execution.stderr || "")
  };
}

function terminalText(rawOutput) {
  try {
    const result = parseClaudeStream(rawOutput)
      .map(({ event }) => event)
      .find((event) => event.type === "result");
    return typeof result?.result === "string" ? result.result : "";
  } catch {
    return "";
  }
}

function fail(message) {
  console.error(`Trigger selection smoke: FAIL\nCause: ${message}\nNo trigger-selection claim was made.`);
  process.exit(2);
}

if (!Number.isSafeInteger(timeout) || timeout < 1000) {
  fail("LOOPSPINE_SMOKE_TIMEOUT must be an integer >= 1000.");
}
if (!fs.existsSync(readbackPath)) fail(`missing ${readbackPath}.`);
const packageMetadata = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
if (typeof packageMetadata.name !== "string" || typeof packageMetadata.version !== "string") {
  fail("package.json must contain string name and version fields.");
}
const expectedReadback = `${packageMetadata.name}@${packageMetadata.version}`;
const version = run("claude", ["--version"], root, 15000);
if (version.status !== 0) fail("Claude Code CLI is unavailable.");
const auth = run("claude", ["auth", "status"], root, 15000);
let authStatus = null;
try {
  authStatus = JSON.parse(auth.stdout || "");
} catch {
  fail("Claude Code authentication status could not be read.");
}
if (auth.status !== 0 || authStatus?.loggedIn !== true) {
  fail("Claude Code is not authenticated. Run `claude auth login`, then retry `npm run smoke:trigger-selection`.");
}

const startedAt = new Date().toISOString();
const resultDir = path.join(root, "results", "trigger-selection", startedAt.replace(/[:.]/g, "-"));
fs.mkdirSync(resultDir, { recursive: true });
const readbackSha256 = sha256File(readbackPath);
const gitStatusBefore = run("git", ["status", "--porcelain"], root, 15000);

const trigger = executeCase("trigger", [
  "/loopspine:loopspine",
  `Use the Read tool to read the exact file ${readbackPath}.`,
  "This is a direct readback. Do not edit files."
].join(" "), resultDir);

const nonTrigger = executeCase("non-trigger", [
  `Use the Read tool to read the exact file ${readbackPath}.`,
  `Report exactly ${expectedReadback} and nothing else.`,
  "Do not invoke LoopSpine or edit files."
].join(" "), resultDir);

const errors = [];
let triggerEvidence = null;
let triggerIsolationEvidence = null;
let triggerReceiptEvidence = null;
let nonTriggerReadEvidence = null;
let nonTriggerIsolationEvidence = null;
try {
  triggerIsolationEvidence = verifyClaudeIsolation({
    rawOutput: trigger.execution.stdout || "",
    pluginRoot: root
  });
} catch (error) {
  errors.push(`trigger isolation: ${error.message}`);
}
try {
  triggerEvidence = verifyClaudeReadEvent({
    rawOutput: trigger.execution.stdout || "",
    pluginRoot: root,
    referencePath: readbackPath,
    referenceSha256: readbackSha256
  });
} catch (error) {
  errors.push(`trigger: ${error.message}`);
}
try {
  triggerReceiptEvidence = verifyLoopSpineReceipt({
    text: terminalText(trigger.execution.stdout || ""),
    expectedLane: "direct",
    expectedProofTerms: [packageMetadata.name, packageMetadata.version]
  });
} catch (error) {
  errors.push(`trigger receipt: ${error.message}`);
}
try {
  nonTriggerReadEvidence = verifyClaudeReadEvent({
    rawOutput: nonTrigger.execution.stdout || "",
    pluginRoot: root,
    referencePath: readbackPath,
    referenceSha256: readbackSha256
  });
} catch (error) {
  errors.push(`non-trigger readback: ${error.message}`);
}
try {
  nonTriggerIsolationEvidence = verifyClaudeIsolation({
    rawOutput: nonTrigger.execution.stdout || "",
    pluginRoot: root
  });
} catch (error) {
  errors.push(`non-trigger isolation: ${error.message}`);
}

const gitStatusAfter = run("git", ["status", "--porcelain"], root, 15000);
const triggerFinal = terminalText(trigger.execution.stdout || "");
const nonTriggerFinal = terminalText(nonTrigger.execution.stdout || "");
const assertions = {
  trigger_exit_zero: trigger.execution.status === 0,
  trigger_not_timed_out: trigger.execution.error?.code !== "ETIMEDOUT",
  trigger_plugin_isolated: Boolean(triggerIsolationEvidence),
  trigger_readback_verified: Boolean(triggerEvidence),
  non_trigger_exit_zero: nonTrigger.execution.status === 0,
  non_trigger_not_timed_out: nonTrigger.execution.error?.code !== "ETIMEDOUT",
  non_trigger_plugin_isolated: Boolean(nonTriggerIsolationEvidence),
  non_trigger_readback_verified: Boolean(nonTriggerReadEvidence),
  trigger_receipt_contract_followed: Boolean(triggerReceiptEvidence),
  non_trigger_exact_readback: nonTriggerFinal.trim() === expectedReadback,
  readback_file_unchanged: sha256File(readbackPath) === readbackSha256,
  tracked_worktree_unchanged: gitStatusBefore.status === 0
    && gitStatusAfter.status === 0
    && gitStatusAfter.stdout === gitStatusBefore.stdout
};
const receipt = {
  schema_version: 1,
  smoke: "explicit-trigger-selection",
  claim: "Explicit LoopSpine invocation applies its compact receipt contract while the same non-invoked readback remains plain.",
  limitations: [
    "This does not prove automatic LoopSpine selection.",
    "This does not prove that explicit invocation improves task quality.",
    "This does not authorize global installation or hooks."
  ],
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  claude_version: `${version.stdout || ""}${version.stderr || ""}`.trim(),
  model_alias: model,
  plugin_root: root,
  readback_path: readbackPath,
  readback_sha256: readbackSha256,
  cases: {
    trigger: {
      invoked_loopspine: true,
      prompt: trigger.prompt,
      duration_ms: trigger.duration_ms,
      exit_code: trigger.execution.status,
      timed_out: trigger.execution.error?.code === "ETIMEDOUT",
      stdout_bytes: trigger.stdout_bytes,
      stderr_bytes: trigger.stderr_bytes,
      final_text: triggerFinal,
      isolation_evidence: triggerIsolationEvidence,
      evidence: triggerEvidence,
      receipt_evidence: triggerReceiptEvidence
    },
    non_trigger: {
      invoked_loopspine: false,
      prompt: nonTrigger.prompt,
      duration_ms: nonTrigger.duration_ms,
      exit_code: nonTrigger.execution.status,
      timed_out: nonTrigger.execution.error?.code === "ETIMEDOUT",
      stdout_bytes: nonTrigger.stdout_bytes,
      stderr_bytes: nonTrigger.stderr_bytes,
      final_text: nonTriggerFinal,
      isolation_evidence: nonTriggerIsolationEvidence,
      readback_evidence: nonTriggerReadEvidence
    }
  },
  assertions,
  errors
};
receipt.passed = Object.values(assertions).every(Boolean) && errors.length === 0;
fs.writeFileSync(path.join(resultDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);

if (receipt.passed) {
  console.log("Trigger selection smoke: PASS");
  console.log("Explicit trigger: package read and LoopSpine receipt contract verified.");
  console.log("Non-trigger: same package read completed with the exact plain response.");
  console.log("Isolation: Read-only plan mode, no MCP servers, tracked worktree unchanged.");
  console.log(`Receipt: ${path.join(resultDir, "receipt.json")}`);
} else {
  console.error("Trigger selection smoke: FAIL");
  console.error(`Cause: ${errors.join("; ") || "one or more receipt assertions failed"}`);
  console.error("No trigger-selection claim was made.");
  console.error(`Receipt: ${path.join(resultDir, "receipt.json")}`);
}
process.exit(receipt.passed ? 0 : 1);
