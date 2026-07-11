import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "fixtures", "parser-quoted-list");
const skillPath = path.join(root, "skills", "loopspine", "SKILL.md");
const taskPath = path.join(fixture, "task.md");
const resultDir = path.join(root, "demo", "latest");
const model = readOption("--model") || process.env.LOOPSPINE_MODEL || "gpt-5.5";
const timeoutMs = Number(readOption("--timeout") || 180000);
if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) throw new Error("--timeout must be an integer >= 1000 milliseconds");
const started = Date.now();

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function run(command, args, cwd, input) {
  const result = spawnSync(command, args, {
    cwd,
    input,
    encoding: "utf8",
    timeout: timeoutMs,
    env: { ...process.env, npm_config_fund: "false", npm_config_update_notifier: "false" },
    stdio: ["pipe", "pipe", "pipe"]
  });
  return {
    command: [command, ...args].join(" "),
    exitCode: result.status,
    signal: result.signal,
    timedOut: result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM",
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error?.message || null
  };
}

function requireRun(result, label) {
  if (result.exitCode !== 0 || result.timedOut) {
    throw new Error(`${label} failed: ${result.error || `${result.stdout}${result.stderr}`.slice(-2000)}`);
  }
}

function write(name, value) {
  fs.writeFileSync(path.join(resultDir, name), value);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

fs.rmSync(resultDir, { recursive: true, force: true });
fs.mkdirSync(resultDir, { recursive: true });
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "loopspine-demo-"));
fs.cpSync(fixture, workDir, { recursive: true });

for (const [command, args, label] of [
  ["git", ["init", "-q"], "git init"],
  ["git", ["config", "user.email", "demo@example.invalid"], "git config email"],
  ["git", ["config", "user.name", "LoopSpine Demo"], "git config name"],
  ["git", ["add", "."], "git add"],
  ["git", ["commit", "-qm", "fixture baseline"], "git commit"]
]) requireRun(run(command, args, workDir), label);

const before = run("npm", ["test"], workDir);
if (before.exitCode === 0) throw new Error("demo fixture must fail before the repair");
write("01-reproduce.txt", `${before.stdout}${before.stderr}`);

const skill = fs.readFileSync(skillPath, "utf8");
const task = fs.readFileSync(taskPath, "utf8");
const agentMessage = path.join(resultDir, "03-agent-receipt.txt");
const prompt = [
  "Follow this frozen LoopSpine skill as operating guidance. Do not edit the skill.",
  `--- SKILL.md ---\n${skill}\n--- END SKILL.md ---`,
  "This fixture is already isolated in a disposable Git repository. Do not create or switch branches and do not edit Git metadata.",
  "Handle the task end to end without asking the user to supervise routine work.",
  "Reproduce the failure, add the focused regression test, make the smallest repair, run npm test, and return the compact LoopSpine receipt.",
  `--- TASK ---\n${task}\n--- END TASK ---`
].join("\n\n");
const agent = run("codex", [
  "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral",
  "--skip-git-repo-check", "--sandbox", "workspace-write", "--model", model,
  "--cd", workDir, "--output-last-message", agentMessage, "-"
], workDir, prompt);
requireRun(agent, "LoopSpine agent");
if (!fs.existsSync(agentMessage) || !fs.readFileSync(agentMessage, "utf8").trim()) {
  throw new Error("LoopSpine agent did not return a receipt");
}

const diff = run("git", ["diff", "--binary", "HEAD"], workDir);
requireRun(diff, "git diff");
write("02-repair.patch", diff.stdout);
const changed = run("git", ["diff", "--name-only", "HEAD"], workDir);
requireRun(changed, "changed-file readback");
const changedFiles = changed.stdout.trim().split("\n").filter(Boolean).sort();
const expectedFiles = ["src/parser.mjs", "test/parser.test.mjs"];
if (JSON.stringify(changedFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(`unexpected changed files: ${changedFiles.join(", ")}`);
}

const after = run("npm", ["test"], workDir);
requireRun(after, "final npm test");
write("04-proof.txt", `${after.stdout}${after.stderr}`);
const independent = run("node", ["verify.mjs"], workDir);
requireRun(independent, "independent verifier");
write("05-independent-proof.txt", `${independent.stdout}${independent.stderr}`);

const reviewPath = path.join(resultDir, "06-review.json");
const reviewPrompt = [
  "Review this completed parser change without editing files.",
  "The required behavior is a quoted comma staying inside one list value, with a focused regression test.",
  "Return pass only when the diff is scoped, the regression test is meaningful, and the provided proof supports the change.",
  `--- DIFF ---\n${diff.stdout}\n--- END DIFF ---`,
  `--- TEST OUTPUT ---\n${after.stdout}${after.stderr}\n--- END TEST OUTPUT ---`
].join("\n\n");
const review = run("codex", [
  "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral",
  "--skip-git-repo-check", "--sandbox", "read-only", "--model", model,
  "--cd", workDir, "--output-schema", path.join(root, "demo", "review-schema.json"),
  "--output-last-message", reviewPath, "-"
], workDir, reviewPrompt);
requireRun(review, "independent review");
const reviewResult = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
if (reviewResult.verdict !== "pass" || reviewResult.findings.length !== 0) {
  throw new Error(`independent review did not pass: ${JSON.stringify(reviewResult)}`);
}

const durationSeconds = Number(((Date.now() - started) / 1000).toFixed(1));
const codexVersion = run("codex", ["--version"], root);
requireRun(codexVersion, "codex version readback");
const receipt = {
  schema_version: 1,
  model,
  codex_version: codexVersion.stdout.trim(),
  skill_sha256: sha256(skillPath),
  duration_seconds: durationSeconds,
  sawyer_interventions: 0,
  incorrect_stop: false,
  changed_files: changedFiles,
  phases: {
    reproduce: { passed: before.exitCode !== 0, exit_code: before.exitCode },
    regression_test: { passed: /red, blue/.test(fs.readFileSync(path.join(workDir, "test", "parser.test.mjs"), "utf8")) },
    repair: { passed: changedFiles.includes("src/parser.mjs") },
    proof: { passed: after.exitCode === 0, command: "npm test" },
    independent_proof: { passed: independent.exitCode === 0, command: "node verify.mjs" },
    review: { passed: reviewResult.verdict === "pass", findings: reviewResult.findings }
  },
  receipt: {
    lane: "build",
    result: "success",
    proof: "npm test and node verify.mjs passed; independent review found no issues",
    boundary: "isolated fixture only; no publish, merge, deploy, or global configuration",
    residue: "none"
  }
};
receipt.success = Object.values(receipt.phases).every((phase) => phase.passed === true)
  && receipt.sawyer_interventions === 0 && receipt.incorrect_stop === false;
write("receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
write("README.md", `# LoopSpine Demo Receipt\n\n` +
  `A fresh \`${model}\` session reproduced the parser failure, added the focused regression test, repaired the parser, passed both proof commands, and cleared an independent read-only review.\n\n` +
  `- Sawyer interventions: \`0\`\n- Duration to proof: \`${durationSeconds}s\`\n- Changed files: \`${changedFiles.join("\`, \`")}\`\n- Review findings: \`0\`\n\n` +
  `See [receipt.json](receipt.json), [repair diff](02-repair.patch), and [review](06-review.json).\n`);

console.log(JSON.stringify({ success: receipt.success, result_dir: resultDir, duration_seconds: durationSeconds, changed_files: changedFiles, review: reviewResult.verdict }, null, 2));
process.exit(receipt.success ? 0 : 1);
