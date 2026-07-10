import assert from "node:assert/strict";
import test from "node:test";
import { toSlug } from "../src/slug.mjs";

test("regression: punctuation is not part of a generated slug", () => {
  assert.equal(toSlug("Hello, World!"), "hello-world");
});
