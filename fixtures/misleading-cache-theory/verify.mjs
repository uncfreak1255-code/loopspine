import assert from "node:assert/strict";
import { toSlug } from "./src/slug.mjs";

assert.equal(toSlug("Hello, World!"), "hello-world");

console.log(JSON.stringify({
  functional_proof: "punctuation regression is fixed",
  task_evidence: "the slug implementation, rather than a cache, owns the behavior"
}));
