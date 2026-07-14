import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { recordDogfood } from "./record-dogfood.mjs";

const unreachableUrl = "https://github.com/uncfreak1255-code/pool-heat-dashboard/commit/4ae5ace98086fd4f6f155a36a7c25d258f6baf8b";

function makeWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "loopspine-record-dogfood-"));
  const dogfoodDir = path.join(tempRoot, "dogfood");
  fs.mkdirSync(dogfoodDir, { recursive: true });
  const registerPath = path.join(dogfoodDir, "register.json");
  const register = {
    schema_version: 1,
    target_tasks: 10,
    tasks: Array.from({ length: 10 }, (_, index) => ({
      id: `DF-${String(index + 1).padStart(2, "0")}`,
      status: "pending"
    }))
  };
  fs.writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);
  const runPath = path.join(tempRoot, "completed-run.json");
  fs.writeFileSync(runPath, `${JSON.stringify({
    id: "DF-03",
    repo: "uncfreak1255-code/pool-heat-dashboard",
    task: "Reject unreachable proof reference before recording dogfood",
    loopspine_invoked: true,
    verified: true,
    sawyer_interventions: 0,
    time_to_proof_seconds: 120,
    incorrect_stop: false,
    proof: "Focused fixture proves the remote proof reference is unreachable",
    proof_references: [{
      type: "commit",
      url: unreachableUrl,
      commit: "4ae5ace98086fd4f6f155a36a7c25d258f6baf8b"
    }]
  }, null, 2)}\n`);
  return { tempRoot, dogfoodDir, registerPath, runPath };
}

const failed = makeWorkspace();
try {
  const beforeRegister = fs.readFileSync(failed.registerPath, "utf8");
  await assert.rejects(
    recordDogfood(failed.runPath, {
      rootDir: failed.tempRoot,
      fetchImpl: async () => ({ ok: false, status: 422 })
    }),
    /unreachable proof reference \(HTTP 422\)/i
  );
  assert.equal(fs.readFileSync(failed.registerPath, "utf8"), beforeRegister, "register must not be mutated when proof is unreachable");
  assert.equal(fs.existsSync(path.join(failed.dogfoodDir, "report.json")), false, "report must not be written when proof is unreachable");
  assert.equal(fs.existsSync(path.join(failed.dogfoodDir, "report.md")), false, "markdown report must not be written when proof is unreachable");
} finally {
  fs.rmSync(failed.tempRoot, { recursive: true, force: true });
}

const passed = makeWorkspace();
try {
  let request;
  const result = await recordDogfood(passed.runPath, {
    rootDir: passed.tempRoot,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    }
  });
  assert.equal(result.recorded, "DF-03");
  assert.equal(request.url, unreachableUrl);
  assert.equal(request.options.method, "HEAD");
  assert.equal(JSON.parse(fs.readFileSync(passed.registerPath, "utf8")).tasks[2].status, "completed");
  assert.equal(fs.existsSync(path.join(passed.dogfoodDir, "report.json")), true);
  assert.equal(fs.existsSync(path.join(passed.dogfoodDir, "report.md")), true);
} finally {
  fs.rmSync(passed.tempRoot, { recursive: true, force: true });
}

console.log("Dogfood record tests passed: remote proof checks fail closed before writes and allow reachable receipts.");
