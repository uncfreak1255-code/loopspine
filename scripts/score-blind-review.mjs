import fs from "node:fs";
import path from "node:path";

const [runArg, judgmentArg] = process.argv.slice(2);
if (!runArg || !judgmentArg) {
  console.error("Usage: node score-blind-review.mjs <sealed-run-dir> <judgments.json>");
  process.exit(2);
}

const runDir = path.resolve(runArg);
const reviewDir = path.join(runDir, "blind-review");
const key = JSON.parse(fs.readFileSync(path.join(reviewDir, "key.json"), "utf8")).key;
const judgments = JSON.parse(fs.readFileSync(path.resolve(judgmentArg), "utf8"));
if (!Array.isArray(judgments.judgments) || judgments.judgments.length !== key.length) {
  throw new Error(`Expected exactly ${key.length} judgments`);
}

const byId = new Map(judgments.judgments.map((item) => [item.id, item]));
const results = key.map((item) => {
  const judgment = byId.get(item.id);
  if (!judgment || !["A", "B", "tie"].includes(judgment.winner)) throw new Error(`Invalid judgment for ${item.id}`);
  const winner = judgment.winner === "tie" ? "tie" : judgment.winner === item.candidate ? "candidate" : "baseline";
  return { ...item, winner, material_regression: judgment.material_regression === true, reason: judgment.reason };
});
const candidateWins = results.filter((item) => item.winner === "candidate").length;
const baselineWins = results.filter((item) => item.winner === "baseline").length;
const ties = results.filter((item) => item.winner === "tie").length;
const candidateWinRate = candidateWins / results.length;
const materialRegressions = results.filter((item) => item.material_regression);
const overheadJustified = judgments.overhead_review?.justified === true;
const accepted = candidateWinRate >= 0.6 && materialRegressions.length === 0 && overheadJustified;
const summary = {
  accepted,
  judge_model: judgments.judge_model,
  pairs: results.length,
  candidate_wins: candidateWins,
  baseline_wins: baselineWins,
  ties,
  candidate_win_rate: Number(candidateWinRate.toFixed(4)),
  material_regressions: materialRegressions,
  overhead_review: judgments.overhead_review,
  rule: "candidate wins >= 60% of all blinded pairs, no material regression, and reviewer justifies measured output overhead",
  results
};
fs.writeFileSync(path.join(reviewDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
process.exit(accepted ? 0 : 1);
