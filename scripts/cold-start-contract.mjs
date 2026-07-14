export const CANDIDATE_SOURCE_BASE_COMMIT = "60fa913bb313312c64ce4c3d57015f96a4999c91";
export const FROZEN_BASELINE_COMMIT = "9dc46946c879d955daa5a37bd839d168936d6a98";
export const NEXT_TASK = "adaptive-harness-receipt-eval";
export const REQUIRED_PROOF_COMMANDS = [
  "npm test",
  "npm run benchmark:adaptive-harness",
  "npm run benchmark:sealed",
  "npm run benchmark:trajectories"
];
export const REQUIRED_EVIDENCE_FILES = [
  "AGENTS.md",
  "docs/plans/adaptive-harness-candidate.md",
  "docs/plans/skill-spine-rollout.md",
  "dogfood/report.json"
];

export const coldStartResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "source_commit",
    "frozen_baseline_commit",
    "promotion_status",
    "next_task",
    "proof_commands",
    "branch_boundary",
    "evidence_files"
  ],
  properties: {
    source_commit: { type: "string" },
    frozen_baseline_commit: { type: "string" },
    promotion_status: { type: "string" },
    next_task: { type: "string" },
    proof_commands: {
      type: "array",
      items: { type: "string" },
      minItems: REQUIRED_PROOF_COMMANDS.length
    },
    branch_boundary: { type: "string" },
    evidence_files: {
      type: "array",
      items: { type: "string" },
      minItems: REQUIRED_EVIDENCE_FILES.length
    }
  }
};

function requireRecord(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("cold-start response must be an object");
  }
}

function requireExactArrayValues(actual, expected, label) {
  if (!Array.isArray(actual) || !expected.every((value) => actual.includes(value))) {
    throw new Error(`cold-start response is missing required ${label}`);
  }
}

function requireEvidenceFiles(actual) {
  const paths = Array.isArray(actual)
    ? actual.map((value) => String(value).replaceAll("\\", "/"))
    : [];
  const complete = REQUIRED_EVIDENCE_FILES.every((relativePath) =>
    paths.some((value) => value === relativePath || value.endsWith(`/${relativePath}`))
  );
  if (!complete) throw new Error("cold-start response is missing required evidence files");
}

function leadingGitCommit(value) {
  return String(value || "").match(/^([0-9a-f]{40})(?:\s|$)/)?.[1] || null;
}

export function verifyColdStartResponse(
  response,
  { expectedSourceCommit = CANDIDATE_SOURCE_BASE_COMMIT } = {}
) {
  requireRecord(response);
  if (leadingGitCommit(response.source_commit) !== expectedSourceCommit) {
    throw new Error("cold-start response reported the wrong source commit");
  }
  if (response.frozen_baseline_commit !== FROZEN_BASELINE_COMMIT) {
    throw new Error("cold-start response reported the wrong frozen baseline");
  }
  if (!String(response.promotion_status || "").toLowerCase().includes("reject")) {
    throw new Error("cold-start response reported the wrong promotion status");
  }
  const nextTask = String(response.next_task || "").toLowerCase();
  if (!nextTask.includes("adaptive-harness") || !nextTask.includes("receipt") || !nextTask.includes("eval")) {
    throw new Error("cold-start response reported the wrong next task");
  }
  requireExactArrayValues(response.proof_commands, REQUIRED_PROOF_COMMANDS, "proof commands");
  const boundary = String(response.branch_boundary || "").toLowerCase();
  if (!/(branch|worktree)/.test(boundary) || !boundary.includes("main") || !/(do not|don't|avoid|not edit|prohibit)/.test(boundary)) {
    throw new Error("cold-start response did not preserve the protected branch boundary");
  }
  requireEvidenceFiles(response.evidence_files);

  return {
    source_commit_matches: true,
    baseline_matches: true,
    promotion_rejected: true,
    next_task_matches: true,
    proof_gate_complete: true,
    protected_branch_boundary: true,
    source_evidence_complete: true
  };
}

export function verifyColdStartTrace(rawOutput) {
  const commands = [];
  for (const line of String(rawOutput || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "item.completed" && event.item?.type === "command_execution") {
      commands.push(String(event.item.command || ""));
    }
  }
  if (!commands.some((command) => /git (?:rev-parse HEAD|log -1)/.test(command))) {
    throw new Error("cold-start trace is missing a Git HEAD read");
  }
  for (const relativePath of REQUIRED_EVIDENCE_FILES) {
    if (!commands.some((command) => command.includes(relativePath))) {
      throw new Error(`cold-start trace did not read ${relativePath}`);
    }
  }
  return {
    git_head_read: true,
    active_plan_read: true,
    completed_rollout_read: true,
    dogfood_report_read: true
  };
}
