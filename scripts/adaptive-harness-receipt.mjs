const FIELDS = ["RED_GATE", "CONTRADICTIONS", "CHALLENGER", "RECOVERY", "REUSE"];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDetailedValue(value, field, states) {
  for (const state of states) {
    if (value === state) return { state, detail: null };
    const match = new RegExp(`^${escapeRegex(state)} \\\"([^\\\"]+)\\\"$`).exec(value);
    if (match) return { state, detail: match[1] };
  }
  throw new Error(`adaptive harness ${field} has an invalid value`);
}

export function parseAdaptiveHarnessReceipt(output) {
  const found = [];
  for (const rawLine of String(output || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const field = FIELDS.find((name) => line.startsWith(`${name}:`));
    if (!field) continue;
    if (found.some((item) => item.field === field)) throw new Error(`adaptive harness receipt has duplicate ${field}`);
    found.push({ field, value: line.slice(field.length + 1).trim() });
  }
  for (const field of FIELDS) {
    if (!found.some((item) => item.field === field)) throw new Error(`adaptive harness receipt is missing ${field}`);
  }
  if (found.map(({ field }) => field).join(",") !== FIELDS.join(",")) {
    throw new Error("adaptive harness receipt fields are not ordered");
  }

  const values = Object.fromEntries(found.map(({ field, value }) => [field, value]));
  const redGate = parseDetailedValue(values.RED_GATE, "RED_GATE", ["exact", "missing-recover", "not-applicable"]);
  if (redGate.state === "exact" && !redGate.detail) throw new Error("adaptive harness RED_GATE exact value needs a quoted command");
  if (redGate.state !== "exact" && redGate.detail) throw new Error("adaptive harness RED_GATE detail is not allowed");
  const contradictions = parseDetailedValue(values.CONTRADICTIONS, "CONTRADICTIONS", ["reconciled", "unresolved-recover", "none"]);
  if (contradictions.state === "reconciled" && !contradictions.detail) throw new Error("adaptive harness CONTRADICTIONS reconciled value needs quoted evidence");
  if (contradictions.state !== "reconciled" && contradictions.detail) throw new Error("adaptive harness CONTRADICTIONS detail is not allowed");
  const challenger = parseDetailedValue(values.CHALLENGER, "CHALLENGER", ["used", "not-used"]);
  if (!challenger.detail) throw new Error("adaptive harness CHALLENGER needs a quoted reason");
  const recovery = parseDetailedValue(values.RECOVERY, "RECOVERY", ["parent-owned", "user-owned", "approval-stop", "not-needed"]);
  if (recovery.detail) throw new Error("adaptive harness RECOVERY detail is not allowed");
  const reuse = parseDetailedValue(values.REUSE, "REUSE", ["proposed-only", "none"]);
  if (reuse.state === "proposed-only" && !reuse.detail) throw new Error("adaptive harness REUSE proposed-only value needs a quoted proposal");
  if (reuse.state === "none" && reuse.detail) throw new Error("adaptive harness REUSE none value cannot include detail");

  return {
    red_gate: redGate,
    contradictions,
    challenger,
    recovery,
    reuse
  };
}

export function verifyAdaptiveHarnessExpectation(receipt, expectations = {}) {
  const failures = [];
  for (const field of ["red_gate", "contradictions", "recovery", "reuse"]) {
    if (expectations[field] === undefined) continue;
    const allowed = Array.isArray(expectations[field]) ? expectations[field] : [expectations[field]];
    if (!allowed.includes(receipt[field]?.state)) {
      failures.push(`${field}: expected ${allowed.join(" | ")}, got ${receipt[field]?.state || "missing"}`);
    }
  }
  return failures;
}
