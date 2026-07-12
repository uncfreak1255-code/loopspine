import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verifyClaudeReadEvent } from "./claude-access-events.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(message);
  process.exit(2);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(command, args, cwd, timeout) {
  return spawnSync(command, args, { cwd, encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] });
}

function resolvePath(filePath, label) {
  try {
    return fs.realpathSync(filePath);
  } catch (error) {
    fail(`${label} does not resolve, so no reference-access claim was made: ${error.message}`);
  }
}

const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  if (!["--plugin-dir", "--reference", "--model", "--timeout"].includes(argv[index])) fail(`Unknown argument: ${argv[index]}`);
  if (!argv[index + 1] || argv[index + 1].startsWith("--")) fail(`Missing value for ${argv[index]}`);
  index += 1;
}

const pluginRoot = resolvePath(option(argv, "--plugin-dir") || root, "Plugin root");
const referenceArg = option(argv, "--reference") || path.join("docs", "design.md");
const referencePath = resolvePath(path.isAbsolute(referenceArg) ? referenceArg : path.join(pluginRoot, referenceArg), "Reference file");
const model = option(argv, "--model") || process.env.LOOPSPINE_CLAUDE_MODEL || "fable";
const timeout = Number(option(argv, "--timeout") || 180000);
if (!Number.isSafeInteger(timeout) || timeout < 1000) fail("--timeout must be an integer >= 1000 milliseconds");

const relativeReference = path.relative(pluginRoot, referencePath);
if (!relativeReference || path.isAbsolute(relativeReference) || relativeReference === ".." || relativeReference.startsWith(`..${path.sep}`)) {
  fail("Reference must resolve inside the selected plugin root");
}

const version = run("claude", ["--version"], pluginRoot, 15000);
if (version.status !== 0) {
  fail("Claude Code CLI was not available, so the installed-plugin probe did not run. No reference-access claim was made.");
}

const referenceSha256Before = sha256File(referencePath);
const gitStatusBefore = run("git", ["status", "--porcelain"], pluginRoot, 15000);
const prompt = [
  "/loopspine:loopspine",
  `Use the Read tool to read the exact file ${referencePath}.`,
  "Then report only its first Markdown heading.",
  "Do not edit files or claim success unless the Read succeeds."
].join(" ");
const claudeArgs = [
  "-p", "--model", model, "--effort", "high",
  "--plugin-dir", pluginRoot,
  "--permission-mode", "plan",
  "--tools", "Read",
  "--allowedTools", "Read",
  "--setting-sources", "user",
  "--strict-mcp-config",
  "--mcp-config", '{"mcpServers":{}}',
  "--output-format", "stream-json",
  "--verbose",
  "--no-session-persistence",
  prompt
];

const startedAt = new Date().toISOString();
const stamp = startedAt.replace(/[:.]/g, "-");
const resultDir = path.join(root, "results", "probes", stamp);
fs.mkdirSync(resultDir, { recursive: true });
const execution = run("claude", claudeArgs, pluginRoot, timeout);
fs.writeFileSync(path.join(resultDir, "stream.jsonl"), execution.stdout || "");
fs.writeFileSync(path.join(resultDir, "stderr.txt"), execution.stderr || "");

const referenceSha256After = sha256File(referencePath);
const gitStatusAfter = run("git", ["status", "--porcelain"], pluginRoot, 15000);
let evidence = null;
let evidenceError = null;
try {
  evidence = verifyClaudeReadEvent({
    rawOutput: execution.stdout || "",
    pluginRoot,
    referencePath,
    referenceSha256: referenceSha256Before
  });
} catch (error) {
  evidenceError = error.message;
}

const assertions = {
  claude_exit_zero: execution.status === 0,
  not_timed_out: execution.error?.code !== "ETIMEDOUT",
  plugin_read_event_verified: Boolean(evidence),
  reference_unchanged: referenceSha256After === referenceSha256Before,
  tracked_worktree_unchanged: gitStatusBefore.status === 0
    && gitStatusAfter.status === 0
    && gitStatusAfter.stdout === gitStatusBefore.stdout
};
const receipt = {
  schema_version: 1,
  probe: "claude-installed-plugin-reference-access",
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  claude_version: `${version.stdout || ""}${version.stderr || ""}`.trim(),
  model_alias: model,
  plugin_root: pluginRoot,
  reference_path: referencePath,
  reference_relative_path: relativeReference,
  reference_sha256_before: referenceSha256Before,
  reference_sha256_after: referenceSha256After,
  command: ["claude", ...claudeArgs.slice(0, -1), "<prompt>"],
  prompt,
  exit_code: execution.status,
  signal: execution.signal,
  timed_out: execution.error?.code === "ETIMEDOUT",
  execution_error: execution.error?.message || null,
  stdout_bytes: Buffer.byteLength(execution.stdout || ""),
  stderr_bytes: Buffer.byteLength(execution.stderr || ""),
  evidence,
  evidence_error: evidenceError,
  assertions
};
receipt.passed = Object.values(assertions).every(Boolean);
fs.writeFileSync(path.join(resultDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);

if (receipt.passed) {
  console.log("Installed-plugin reference probe: PASS");
  console.log(`Reference access: Read request and correlated result verified before the terminal result.`);
  console.log(`Reference: ${relativeReference} (${referenceSha256Before})`);
  console.log(`Receipt: ${path.join(resultDir, "receipt.json")}`);
} else {
  console.error("Installed-plugin reference probe: FAIL");
  console.error(`No reference-access claim was made. ${evidenceError || "See the receipt assertions."}`);
  console.error(`Receipt: ${path.join(resultDir, "receipt.json")}`);
}
process.exit(receipt.passed ? 0 : 1);
