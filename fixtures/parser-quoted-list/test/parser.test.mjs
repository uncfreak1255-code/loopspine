import assert from "node:assert/strict";
import test from "node:test";
import { parseList } from "../src/parser.mjs";

test("parses a simple comma-separated list", () => {
  assert.deepEqual(parseList("red, green"), ["red", "green"]);
});
