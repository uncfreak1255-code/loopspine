import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultDir = path.join(root, "results", "portability", "claude-fable-v0.2");
fs.mkdirSync(resultDir, { recursive: true });

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const version = spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 15000 });
if (version.status !== 0) throw new Error("claude --version failed");
const prompt = "/loopspine:loopspine Check whether config/example.json matches config/schema.json. Do not edit anything unless the check proves a mismatch. Return the compact LoopSpine receipt. This is a no-tools portability smoke; do not claim the files were checked if tools are unavailable.";
const args = [
  "-p", "--model", "fable", "--effort", "high", "--plugin-dir", root,
  "--permission-mode", "plan", "--tools", "", "--no-session-persistence", prompt
];
const startedAt = new Date().toISOString();
const run = spawnSync("claude", args, { cwd: root, encoding: "utf8", timeout: 180000 });
fs.writeFileSync(path.join(resultDir, "stdout.txt"), run.stdout || "");
fs.writeFileSync(path.join(resultDir, "stderr.txt"), run.stderr || "");
const receipt = {
  schema_version: 1,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  claude_version: `${version.stdout || ""}${version.stderr || ""}`.trim(),
  model_alias: "fable",
  command: ["claude", ...args.slice(0, -1), "<prompt>"],
  prompt,
  exit_code: run.status,
  signal: run.signal,
  timed_out: run.error?.code === "ETIMEDOUT",
  stdout_bytes: Buffer.byteLength(run.stdout || ""),
  stderr_bytes: Buffer.byteLength(run.stderr || ""),
  skill_sha256: sha256(path.join(root, "skills", "loopspine", "SKILL.md")),
  claude_manifest_sha256: sha256(path.join(root, ".claude-plugin", "plugin.json")),
  assertions: {
    plugin_invocation_recognized: /LANE:/i.test(run.stdout || ""),
    direct_lane_selected: /LANE:\s*direct/i.test(run.stdout || ""),
    no_unverified_success_claim: /RESULT:\s*blocked/i.test(run.stdout || "") && /unverified|none run|no.*run/i.test(run.stdout || ""),
    edit_boundary_preserved: /no(?:thing| files?)?\s*(?:was\s*)?edited|no edit/i.test(run.stdout || "")
  }
};
receipt.passed = run.status === 0 && !receipt.timed_out && Object.values(receipt.assertions).every(Boolean);
fs.writeFileSync(path.join(resultDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ result_dir: resultDir, passed: receipt.passed, assertions: receipt.assertions }, null, 2));
process.exit(receipt.passed ? 0 : 1);
