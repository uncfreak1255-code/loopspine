import assert from "node:assert/strict";
import fs from "node:fs";
import { parseList } from "./src/parser.mjs";

const actual = parseList('"red, blue",green');
assert.deepEqual(actual, ["red, blue", "green"]);

const focusedTest = fs.readFileSync(new URL("./test/parser.test.mjs", import.meta.url), "utf8");
assert.match(focusedTest, /red, blue/);
assert.match(focusedTest, /quoted|comma/i);

console.log(JSON.stringify({
  functional_proof: "quoted comma is parsed as one value",
  task_evidence: "focused quoted-comma test is present"
}));
