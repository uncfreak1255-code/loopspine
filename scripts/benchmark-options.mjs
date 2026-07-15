import path from "node:path";

export function benchmarkUsage() {
  return "Usage: node run-benchmark.mjs [--pilot] [--sealed|--sealed-only] [--development-file PATH] [--sealed-file PATH] [--baseline-skill-file PATH] [--candidate-overlay-file PATH] [--require-strict-cases CSV] [--candidate-score-floor 0..1] [--samples N] [--seed VALUE] [--model NAME]";
}

export function parseBenchmarkArgs(argv, env = process.env) {
  const options = {
    pilot: false,
    sealed: false,
    sealedOnly: false,
    developmentFile: path.join("evals", "evals.json"),
    sealedFile: path.join("evals", "sealed-v2.json"),
    baselineSkillFile: null,
    candidateOverlayFile: null,
    requireStrictCases: [],
    candidateScoreFloor: null,
    samples: null,
    seed: "loopspine-v2",
    model: env.LOOPSPINE_MODEL || "gpt-5.5"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--pilot") options.pilot = true;
    else if (arg === "--sealed") options.sealed = true;
    else if (arg === "--sealed-only") options.sealedOnly = true;
    else if ([
      "--development-file",
      "--sealed-file",
      "--baseline-skill-file",
      "--candidate-overlay-file",
      "--require-strict-cases",
      "--candidate-score-floor",
      "--samples",
      "--seed",
      "--model"
    ].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      if (arg === "--samples") {
        if (!/^\d+$/.test(value) || Number(value) < 1) throw new Error("--samples must be a positive integer");
        options.samples = Number(value);
      } else if (arg === "--candidate-score-floor") {
        const score = Number(value);
        if (value.trim() === "" || !Number.isFinite(score) || score < 0 || score > 1) {
          throw new Error("--candidate-score-floor must be a score floor from 0 to 1");
        }
        options.candidateScoreFloor = score;
      } else if (arg === "--require-strict-cases") {
        const ids = value.split(",").map((item) => item.trim()).filter(Boolean);
        if (!ids.length || ids.length !== value.split(",").length || new Set(ids).size !== ids.length) {
          throw new Error("--require-strict-cases must contain unique, non-empty strict cases");
        }
        options.requireStrictCases = ids;
      } else if (arg === "--development-file") options.developmentFile = value;
      else if (arg === "--sealed-file") options.sealedFile = value;
      else if (arg === "--baseline-skill-file") options.baselineSkillFile = value;
      else if (arg === "--candidate-overlay-file") options.candidateOverlayFile = value;
      else if (arg === "--seed") options.seed = value;
      else options.model = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.sealed && options.sealedOnly) throw new Error("--sealed and --sealed-only cannot be used together");
  if (options.pilot && options.sealedOnly) throw new Error("--pilot and --sealed-only cannot be used together");
  options.samples ??= options.pilot ? 1 : 3;
  return options;
}
