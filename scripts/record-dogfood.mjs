import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { calculateDogfoodMetrics, renderDogfoodMarkdown } from "./dogfood-metrics.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");

export function verifyGitHubReferenceWithGh(reference, spawnImpl = spawnSync) {
  let url;
  try {
    url = new URL(reference.url);
  } catch {
    return false;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 4 || parts[2] !== "commit") {
    return false;
  }
  const [owner, repo, , commit] = parts;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo) || !/^[0-9a-f]{40}$/.test(commit) || reference.commit !== commit) {
    return false;
  }
  const result = spawnImpl("gh", [
    "api",
    "--method",
    "GET",
    "--silent",
    `repos/${owner}/${repo}/commits/${commit}`
  ], {
    encoding: "utf8",
    timeout: 10_000
  });
  return !result.error && result.status === 0;
}

export async function verifyProofReferencesReachable(run, fetchImpl = fetch, githubVerifier = verifyGitHubReferenceWithGh) {
  for (const reference of run.proof_references || []) {
    let response;
    try {
      response = await fetchImpl(reference.url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(10_000)
      });
    } catch (error) {
      throw new Error(`${run.id}: could not verify proof reference ${reference.url}: ${error.message}`);
    }
    if (!response?.ok) {
      const status = response?.status ? `HTTP ${response.status}` : "no HTTP response";
      if ([401, 403, 404].includes(response?.status) && await githubVerifier(reference)) continue;
      const authenticated = [401, 403, 404].includes(response?.status)
        ? "; authenticated GitHub verification failed"
        : "";
      throw new Error(`${run.id}: unreachable proof reference (${status}${authenticated}): ${reference.url}`);
    }
  }
}

export async function recordDogfood(runArg, { rootDir = root, fetchImpl = fetch, githubVerifier = verifyGitHubReferenceWithGh } = {}) {
  const registerPath = path.join(rootDir, "dogfood", "register.json");
  const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
  const run = JSON.parse(fs.readFileSync(path.resolve(runArg), "utf8"));
  const task = register.tasks.find((item) => item.id === run.id);
  if (!task) throw new Error(`unknown dogfood task id: ${run.id}`);
  if (task.status === "completed") throw new Error(`${run.id} is already completed`);
  for (const key of ["repo", "task", "proof"]) if (!run[key]) throw new Error(`${run.id}: missing ${key}`);
  if (run.loopspine_invoked !== true) throw new Error(`${run.id}: loopspine_invoked must be true`);
  for (const key of ["verified", "incorrect_stop"]) if (typeof run[key] !== "boolean") throw new Error(`${run.id}: ${key} must be boolean`);
  if (!Number.isInteger(run.sawyer_interventions) || run.sawyer_interventions < 0) throw new Error(`${run.id}: invalid sawyer_interventions`);
  if (!Number.isFinite(run.time_to_proof_seconds) || run.time_to_proof_seconds <= 0) throw new Error(`${run.id}: invalid time_to_proof_seconds`);
  Object.assign(task, run, { status: "completed", recorded_at: new Date().toISOString() });
  const metrics = calculateDogfoodMetrics(register);
  await verifyProofReferencesReachable(run, fetchImpl, githubVerifier);
  fs.writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);
  fs.writeFileSync(path.join(rootDir, "dogfood", "report.json"), `${JSON.stringify(metrics, null, 2)}\n`);
  fs.writeFileSync(path.join(rootDir, "dogfood", "report.md"), renderDogfoodMarkdown(metrics));
  return { recorded: run.id, report: metrics };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const [runArg] = process.argv.slice(2);
  if (!runArg) {
    console.error("Usage: node record-dogfood.mjs <completed-run.json>");
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(await recordDogfood(runArg), null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
