import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = path.join(root, "fixtures");
const skillPath = path.join(root, "skills", "loopspine", "SKILL.md");
const timeoutMs = readTimeout(process.argv);
const model = readOption(process.argv, "--model") || process.env.LOOPSPINE_MODEL || "gpt-5.5";
const dryRun = process.argv.includes("--dry-run");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const resultDir = path.join(root, "results", "trajectories", stamp);
const variants = ["without-skill", "with-skill"];
const baselineInstructions = [
  "You are a capable senior coding agent working in an isolated repository.",
  "Inspect the current files, execute the requested task, run the proof command, and report the evidence.",
  "Do not stop at a plan or merely describe edits."
].join(" ");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function version(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 15000 });
  if (result.status !== 0) throw new Error(`unable to read ${command} version`);
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function readTimeout(args) {
  const raw = readOption(args, "--timeout");
  if (raw == null) return 180000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1000) {
    throw new Error("--timeout must be an integer number of milliseconds >= 1000");
  }
  return value;
}

function writeText(filePath, value, label, required = false) {
  if (required && !String(value).trim()) throw new Error(`missing ${label}`);
  fs.writeFileSync(filePath, value);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, cwd, input = undefined) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    input,
    timeout: timeoutMs,
    env: {
      ...process.env,
      npm_config_fund: "false",
      npm_config_update_notifier: "false"
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  return {
    command: [command, ...args].join(" "),
    exitCode: result.status,
    signal: result.signal,
    timedOut: result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM",
    error: result.error?.message || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function combinedOutput(result) {
  return `${result.stdout}${result.stderr}`;
}

function requireSuccessful(result, label) {
  if (result.exitCode !== 0 || result.timedOut) {
    throw new Error(`${label} failed: ${result.error || combinedOutput(result).slice(-2000)}`);
  }
}

function fixtureNames() {
  return fs.readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function taskPrompt(task, variant, skill) {
  const supplied = variant === "with-skill"
    ? `Here is the frozen current workflow skill. Follow it as operating guidance; do not edit it.\n\n--- SKILL.md ---\n${skill}\n--- END SKILL.md ---`
    : `No workflow skill is supplied for this control condition. Use ordinary engineering judgment.`;
  return [
    supplied,
    baselineInstructions,
    "You may edit the implementation and task-appropriate tests or documentation only.",
    "Do not edit task.md, verify.mjs, or package.json unless the task explicitly says to.",
    "Run npm test yourself after the change. In your final response, state the lane you used, the proof command and result, and any root cause or task-specific evidence.",
    "\n# User Task\n",
    task
  ].join("\n\n");
}

function changedFiles(cwd) {
  const tracked = run("git", ["diff", "--name-only", "HEAD"], cwd);
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard"], cwd);
  const files = new Set([
    ...tracked.stdout.split("\n").map((line) => line.trim()).filter(Boolean),
    ...untracked.stdout.split("\n").map((line) => line.trim()).filter(Boolean)
  ]);
  return [...files].sort();
}

function snapshot(cwd, relativePath) {
  return fs.readFileSync(path.join(cwd, relativePath), "utf8");
}

function independentCheck(fixture, cwd) {
  if (fixture === "parser-quoted-list") {
    return run("node", ["--input-type=module", "-e", [
      "import { parseList } from './src/parser.mjs';",
      "const actual = JSON.stringify(parseList('\"red, blue\",green'));",
      "if (actual !== JSON.stringify(['red, blue', 'green'])) process.exit(1);",
      "console.log('INDEPENDENT_BEHAVIOR=PASS');"
    ].join(" ")], cwd);
  }
  if (fixture === "misleading-cache-theory") {
    return run("node", ["--input-type=module", "-e", [
      "import { toSlug } from './src/slug.mjs';",
      "if (toSlug('Hello, World!') !== 'hello-world') process.exit(1);",
      "console.log('INDEPENDENT_BEHAVIOR=PASS');"
    ].join(" ")], cwd);
  }
  const readme = snapshot(cwd, "README.md");
  const link = readme.match(/\[Usage\]\(([^)]+)\)/)?.[1];
  const resolves = link && fs.existsSync(path.resolve(cwd, link));
  return run("node", ["-e", `if (${JSON.stringify(Boolean(resolves))} !== true) process.exit(1); console.log('INDEPENDENT_LINK=PASS');`], cwd);
}

function taskEvidence(fixture, cwd, baseline, agentText, proof) {
  const files = changedFiles(cwd);
  const independent = independentCheck(fixture, cwd);
  const independentOutput = combinedOutput(independent);
  const base = {
    changedFiles: files,
    independentCheck: {
      command: independent.command,
      exitCode: independent.exitCode,
      output: independentOutput,
      passed: independent.exitCode === 0 && !independent.timedOut && Boolean(independentOutput.trim())
    }
  };

  if (fixture === "parser-quoted-list") {
    const testSource = snapshot(cwd, "test/parser.test.mjs");
    const sourceChanged = snapshot(cwd, "src/parser.mjs") !== baseline.source;
    const focusedTestAdded = files.includes("test/parser.test.mjs")
      && testSource !== baseline.test
      && /red, blue/.test(testSource)
      && /quoted|comma/i.test(testSource);
    return {
      ...base,
      sourceImplementationChanged: sourceChanged,
      focusedTestAdded,
      passed: proof.exitCode === 0 && sourceChanged && focusedTestAdded && base.independentCheck.passed
    };
  }

  if (fixture === "misleading-cache-theory") {
    const sourceChanged = files.includes("src/slug.mjs") && snapshot(cwd, "src/slug.mjs") !== baseline.source;
    const noCacheTheoryChurn = files.length > 0 && files.every((file) => !/cache/i.test(file));
    const rootCauseExplained = /root\s+cause/i.test(agentText)
      && /cache/i.test(agentText)
      && /(?:not|no|false|wrong|unrelated|unsupported)[\s\S]{0,100}cache/i.test(agentText);
    return {
      ...base,
      actualBugModuleChanged: sourceChanged,
      noCacheTheoryChurn,
      rootCauseExplained,
      passed: proof.exitCode === 0 && sourceChanged && noCacheTheoryChurn
        && rootCauseExplained && base.independentCheck.passed
    };
  }

  const readme = snapshot(cwd, "README.md");
  const link = readme.match(/\[Usage\]\(([^)]+)\)/)?.[1];
  const docsOnly = files.length > 0 && files.every((file) => file === "README.md" || file === "docs/usage.md");
  const headingFixed = /^## Usage$/m.test(readme);
  const linkFixed = link === "docs/usage.md";
  const linkResolves = linkFixed && fs.existsSync(path.resolve(cwd, link));
  return {
    ...base,
    headingFixed,
    linkFixed,
    linkResolves,
    noExecutableCodeChurn: docsOnly,
    passed: proof.exitCode === 0 && headingFixed && linkFixed && linkResolves && docsOnly && base.independentCheck.passed
  };
}

function initFixture(sourceDir, workDir) {
  fs.cpSync(sourceDir, workDir, { recursive: true });
  requireSuccessful(run("git", ["init", "-q"], workDir), "git init");
  requireSuccessful(run("git", ["config", "user.email", "trajectory@example.invalid"], workDir), "git config email");
  requireSuccessful(run("git", ["config", "user.name", "Trajectory Harness"], workDir), "git config name");
  requireSuccessful(run("git", ["add", "."], workDir), "git add baseline");
  requireSuccessful(run("git", ["commit", "-qm", "fixture baseline"], workDir), "git commit baseline");
}

function executeVariant(fixture, variant, task, sourceDir, skill, fixtureResultDir) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `loopspine-${fixture}-${variant}-`));
  fs.mkdirSync(fixtureResultDir, { recursive: true });
  writeText(path.join(fixtureResultDir, "workdir.txt"), `${workDir}\n`, "workdir", true);
  initFixture(sourceDir, workDir);
  const baseline = {
    test: fixture === "parser-quoted-list" ? snapshot(workDir, "test/parser.test.mjs") : null,
    source: fixture === "parser-quoted-list" ? snapshot(workDir, "src/parser.mjs")
      : fixture === "misleading-cache-theory" ? snapshot(workDir, "src/slug.mjs") : null
  };

  const initial = run("npm", ["test"], workDir);
  writeText(path.join(fixtureResultDir, "initial-test.txt"), combinedOutput(initial), "initial test output", true);

  const lastMessagePath = path.join(fixtureResultDir, "agent-last-message.txt");
  const agent = run("codex", [
    "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral",
    "--skip-git-repo-check", "--sandbox", "workspace-write", "--model", model,
    "--cd", workDir, "--output-last-message", lastMessagePath, "-"
  ], workDir, taskPrompt(task, variant, skill));
  const lastMessage = fs.existsSync(lastMessagePath) ? fs.readFileSync(lastMessagePath, "utf8") : "";
  writeText(path.join(fixtureResultDir, "agent-stdout.log"), agent.stdout, "agent stdout");
  writeText(path.join(fixtureResultDir, "agent-stderr.log"), agent.stderr, "agent stderr");
  writeText(path.join(fixtureResultDir, "agent-transcript.log"), combinedOutput(agent), "agent process output");
  if (!lastMessage.trim()) throw new Error(`${variant}/${fixture}: missing agent final message`);
  writeText(lastMessagePath, lastMessage, "agent final message", true);

  const status = run("git", ["status", "--short"], workDir);
  const diff = run("git", ["diff", "--binary", "HEAD"], workDir);
  writeText(path.join(fixtureResultDir, "git-status.txt"), status.stdout, "git status");
  writeText(path.join(fixtureResultDir, "git-diff.patch"), diff.stdout, "git diff");

  const proof = run("npm", ["test"], workDir);
  writeText(path.join(fixtureResultDir, "test-output.txt"), combinedOutput(proof), "final test output", true);
  const agentText = `${agent.stdout}\n${agent.stderr}\n${lastMessage}`;
  const evidence = taskEvidence(fixture, workDir, baseline, agentText, proof);
  writeJson(path.join(fixtureResultDir, "verification.json"), {
    functionalProof: {
      command: "npm test",
      exitCode: proof.exitCode,
      timedOut: proof.timedOut,
      passed: proof.exitCode === 0 && !proof.timedOut && Boolean(combinedOutput(proof).trim())
    },
    taskEvidence: evidence
  });
  return {
    fixture,
    variant,
    workDir,
    initialTest: { exitCode: initial.exitCode, passed: initial.exitCode === 0 },
    agent: {
      command: agent.command,
      exitCode: agent.exitCode,
      timedOut: agent.timedOut,
      finalMessageBytes: Buffer.byteLength(lastMessage)
    },
    functionalProof: {
      command: "npm test",
      exitCode: proof.exitCode,
      passed: proof.exitCode === 0 && !proof.timedOut && Boolean(combinedOutput(proof).trim())
    },
    taskEvidence: evidence,
    success: initial.exitCode !== 0 && agent.exitCode === 0 && !agent.timedOut && proof.exitCode === 0 && evidence.passed
  };
}

function main() {
  const fixtures = fixtureNames();
  assert.equal(fixtures.length, 3, "expected exactly three trajectory fixtures");
  assert.ok(fs.existsSync(skillPath), `missing frozen skill: ${skillPath}`);
  const skill = fs.readFileSync(skillPath, "utf8");
  fs.mkdirSync(resultDir, { recursive: true });
  const summary = {
    schemaVersion: 2,
    startedAt: new Date().toISOString(),
    model,
    codexVersion: version("codex"),
    skillSha256: sha256(skillPath),
    timeoutMs,
    dryRun,
    skillPath,
    resultDir,
    fixtures,
    variants,
    cases: []
  };

  if (dryRun) {
    for (const fixture of fixtures) {
      const task = fs.readFileSync(path.join(fixturesRoot, fixture, "task.md"), "utf8");
      for (const variant of variants) {
        summary.cases.push({
          fixture,
          variant,
          planned: true,
          proofCommand: "npm test",
          sandbox: "workspace-write",
          ephemeral: true,
          promptBytes: Buffer.byteLength(taskPrompt(task, variant, skill))
        });
      }
    }
    summary.finishedAt = new Date().toISOString();
    summary.overallPassed = null;
    writeJson(path.join(resultDir, "summary.json"), summary);
    console.log(`Dry run: ${resultDir}`);
    return 0;
  }

  for (const fixture of fixtures) {
    const sourceDir = path.join(fixturesRoot, fixture);
    const task = fs.readFileSync(path.join(sourceDir, "task.md"), "utf8");
    for (const variant of variants) {
      const fixtureResultDir = path.join(resultDir, variant, fixture);
      console.log(`[${variant}] ${fixture}`);
      try {
        const result = executeVariant(fixture, variant, task, sourceDir, skill, fixtureResultDir);
        summary.cases.push(result);
        writeJson(path.join(resultDir, "summary.json"), summary);
      } catch (error) {
        const failure = { fixture, variant, success: false, error: error.message };
        summary.cases.push(failure);
        fs.mkdirSync(fixtureResultDir, { recursive: true });
        writeJson(path.join(fixtureResultDir, "failure.json"), failure);
        writeJson(path.join(resultDir, "summary.json"), summary);
      }
    }
  }

  summary.finishedAt = new Date().toISOString();
  summary.overallPassed = summary.cases.length === fixtures.length * variants.length
    && summary.cases.every((item) => item.success === true);
  writeJson(path.join(resultDir, "summary.json"), summary);
  console.log(`Results: ${resultDir}`);
  console.log(JSON.stringify({ overallPassed: summary.overallPassed, cases: summary.cases.length }, null, 2));
  return summary.overallPassed ? 0 : 3;
}

process.exitCode = main();
