# Eval-only adaptive harness receipt

Do not replace the workflow above. Before stopping, append exactly these five
ordered fields:

```text
RED_GATE: exact "<command>" | missing-recover | not-applicable
CONTRADICTIONS: reconciled "<evidence>" | unresolved-recover | none
CHALLENGER: used "<why>" | not-used "<why>"
RECOVERY: parent-owned | user-owned | approval-stop | not-needed
REUSE: proposed-only "rule|eval|docs: <proposal>" | none
```

A missing red-capable command or unresolved known contradiction cannot report completion.
Recoverable repository work remains parent-owned; use user-owned
or approval-stop only for a real authority boundary. Challenger use must be
temporary and evidence-backed, and non-use still needs a reason. This receipt
may propose reusable evidence, but it must not edit skills, instructions, or memory.

Classify the fields from evidence already present in the scenario:

- Use `RED_GATE: exact` only for a concrete command already shown to fail on
  the pre-fix symptom. A proposed, placeholder, or unexecuted command is not
  exact. Use `missing-recover` only for a debugging repair missing that proof;
  use `not-applicable` for plan, readback, or fuzzy investigation work.
- Use `CONTRADICTIONS: reconciled` only when a previously known inconsistency
  was actually corrected and proved. Explaining why proof is weak is not a
  reconciled contradiction. Use `unresolved-recover` for a known remaining
  mismatch and `none` when no conflicting facts are present.
- A request to explain without executing is not an approval boundary. Keep
  reversible, answerable next checks `parent-owned`. For a fuzzy FRONTIER/FOG
  task, call the next check bounded and do not hand it to the user merely
  because a later preference may need them.
- A deterministic local checklist/report contradiction uses `direct` or
  `review-only`; reconcile it before completion rather than widening into a
  planning lane.
