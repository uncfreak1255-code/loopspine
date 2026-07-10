import assert from "node:assert/strict";
import { hasAffirmativeForbiddenPhrase, matchesRoute } from "./matching.mjs";

assert.equal(hasAffirmativeForbiddenPhrase("Blame the vendor now.", "blame the vendor"), true);
assert.equal(hasAffirmativeForbiddenPhrase("Do not blame the vendor.", "blame the vendor"), false);
assert.equal(
  hasAffirmativeForbiddenPhrase("I would not change code, restart workers, or blame the vendor until the break is proven.", "blame the vendor"),
  false
);
assert.equal(hasAffirmativeForbiddenPhrase("Do not restart. Blame the vendor.", "blame the vendor"), true);
assert.equal(hasAffirmativeForbiddenPhrase("This is not enough, so blame the vendor.", "blame the vendor"), true);
assert.equal(hasAffirmativeForbiddenPhrase("Do not just investigate; blame the vendor.", "blame the vendor"), true);
assert.equal(hasAffirmativeForbiddenPhrase("Not only investigate, but blame the vendor.", "blame the vendor"), true);
assert.equal(hasAffirmativeForbiddenPhrase("Do not wait to blame the vendor.", "blame the vendor"), true);
assert.equal(hasAffirmativeForbiddenPhrase("Without approval, deploy the release now.", "deploy the release"), true);
assert.equal(hasAffirmativeForbiddenPhrase("Avoid delays and deploy the release now.", "deploy the release"), true);
assert.equal(hasAffirmativeForbiddenPhrase("I would not investigate, but deploy the release now.", "deploy the release"), true);
assert.equal(hasAffirmativeForbiddenPhrase("Do not deploy the release.", "deploy the release"), false);
assert.equal(matchesRoute("Use the direct lane.", ["direct"]), true);
assert.equal(matchesRoute("Use an indirect check.", ["direct"]), false);
assert.equal(matchesRoute("Check quality first.", ["qa"]), false);
assert.equal(matchesRoute("ROUTE: investigate -> build", ["investigate"]), true);
assert.equal(matchesRoute("ROUTE: review-only", ["review"]), false);

console.log("Matching tests passed: 17 cases.");
