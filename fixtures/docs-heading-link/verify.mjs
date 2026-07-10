import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
assert.match(readme, /^## Usage$/m);

const link = readme.match(/\[Usage\]\(([^)]+)\)/);
assert.ok(link, "README must contain a Usage link");
const target = path.resolve(root, link[1]);
assert.ok(fs.existsSync(target), `Usage link does not resolve: ${link[1]}`);
assert.equal(path.relative(root, target), "docs/usage.md");

console.log(JSON.stringify({
  functional_proof: "README Usage link resolves",
  task_evidence: "heading and link repaired without needing executable code"
}));
