# Matt Pocock Donor Audit

Date: 2026-07-14

Decision: keep the LoopSpine v0.2.0 skill text unchanged after the completed
pilot. Retain the red-capable debugging and bounded temporary-responsibility
evals. Do not add hooks, permanent agents, or disclosed reference files from
this audit alone. Keep use explicit and local rather than making LoopSpine the
global/default spine.

## Scope

This is a donor review, not an adoption review. It compares LoopSpine with four
ideas from Matt Pocock's skills repository at commit
`66898f60e8c744e269f8ce06c2b2b99ce7660d5f`:

- [writing-great-skills](https://github.com/mattpocock/skills/blob/66898f60e8c744e269f8ce06c2b2b99ce7660d5f/skills/productivity/writing-great-skills/SKILL.md)
- [skill-writing glossary](https://github.com/mattpocock/skills/blob/66898f60e8c744e269f8ce06c2b2b99ce7660d5f/skills/productivity/writing-great-skills/GLOSSARY.md)
- [diagnosing-bugs](https://github.com/mattpocock/skills/blob/66898f60e8c744e269f8ce06c2b2b99ce7660d5f/skills/engineering/diagnosing-bugs/SKILL.md)
- [wayfinder](https://github.com/mattpocock/skills/blob/66898f60e8c744e269f8ce06c2b2b99ce7660d5f/skills/engineering/wayfinder/SKILL.md)

The useful tests are predictable invocation, a red-capable debugging signal,
frontier-versus-fog unknown discovery, checkable completion criteria, and
pruning instructions that do not change behavior.

## Two-Axis Review

### Invocation: Pass For The Local Pilot

LoopSpine's description names the non-trivial work it should handle and ends
with a concrete non-trigger for simple questions and tiny edits. The pilot does
not install that description globally; it exposes the skill only in selected
repositories or explicit plugin sessions. DF-02 also proved that a simple
non-invoked readback did not produce a LoopSpine receipt while the plugin was
available.

The description is broad enough that false local triggers remain worth
recording. That is a pilot metric, not yet a reason to make the skill
user-invoked or rewrite the trigger. Change it only after a repeated false
trigger or a paired candidate clears the frozen-baseline gate.

### Execution: Useful Gaps Are Now Evals

The skill has an ordered fresh-state, lane, loop, autonomy, stop, and receipt
path. Its completion conditions are observable, and its hard negations protect
real approval and proof boundaries. The lane summaries are primary steps used
on every relevant run, not branch-only reference that clearly belongs behind a
new context pointer.

Two measured gaps remain:

1. A one-sample pilot response scored `5/9` on the stricter red-capable debug
   case. It reproduced before editing but did not name one command that could
   fail on the exact symptom and be rerun unchanged.
2. A one-sample pilot response scored `10/13` on the temporary-responsibility
   case. It separated FRONTIER from FOG and kept one lead, but did not state the
   `only when`, bounded, and independent delegation conditions explicitly.

Those failures justify the development evals in `evals/evals.json`. They do not
yet justify more core prose: LoopSpine v0.2.0 remains the frozen baseline, and
the earlier adaptive overlays did not clear the required quality gate.

## Independent Review

A fresh read-only Codex session (`019f618e-57a9-73f3-8249-5c9a1b76eb20`)
reviewed the skill against the rollout spec and benchmark method. It recommended
`ADD EVAL FIRST` and made no edits. Its concerns were checked against current
evidence:

| Concern | Evidence decision |
|---|---|
| Broad model-triggered description | Keep measuring. DF-02 already passed a real non-trigger smoke, and the skill is not global. |
| Frontier-versus-fog confusion | Covered by the new development eval and the GBrain source-routing task. |
| Unnecessary Cartographer or Skeptic ceremony | Covered by the new development eval and the GBrain task's parent-owned integration. |
| Abbreviated lanes could bypass specialists | Unobserved hypothesis. Do not add an eval or reference split until a real task misses a specialist gate. |
| Review-only could mutate state | Existing review-only eval forbids edits; this DF-10 review also left tracked state unchanged. |

## Checkpoint Decisions

### DF-03

The real pool-dashboard bug task established a red baseline, applied the
smallest fix, passed focused tests, lint, build, and independent review. Keep the
new red-capable eval because the descriptive pilot response missed its stricter
command-level completion criteria. Do not change the skill during this pilot.

### DF-06

The real GBrain source-routing task separated immediately testable questions
from unresolved fog, used one bounded independent challenge, and returned
parent-verified source readbacks without permanent roles. Keep the new
temporary-responsibility eval because its one-sample descriptive response
missed three explicit bounds. Do not create Cartographer or Skeptic agent files.

### DF-10

The skill-writing audit found no evidence-backed reason to alter invocation,
split the skill, or add a hook. Keep v0.2.0 as the execution baseline and use the
two new evals as gates for any later candidate.

## Verification Receipt

| Gate | Result |
|---|---|
| `npm test` | Pass: 2 manifests, 1 skill, 19 development cases, 6 sealed cases, 17 matching tests, dogfood metric and recorder tests, and 19 Claude access-event tests. |
| `npm run benchmark:pilot` | Diagnostic pass: `+18.75` weighted points over the no-skill control, `0` boundary violations, `-31.22%` runtime overhead, and `-7.25%` output overhead. This is one sample and not a public performance claim. |
| Frozen-baseline sealed comparison | **Fail:** current `0.9412` versus frozen v0.2.0 `0.9673`, delta `-0.0261`, strict-pass delta `-0.1666`, and `0` boundary violations across 3 samples. Runtime overhead was `-3.22%`; output overhead was `+7.81%`. Both variants used the same skill SHA-256, `5f58a9f74a57569f3554e33d24508464ede7bb50589a5eb24e38073fe2d905a6`, so the difference is sampling and phrase-matcher variance, but the recorded gate remains failed. |
| `npm run benchmark:trajectories` | Pass: all 6 executable fixture cases passed, covering 3 tasks with and without the skill. |
| Claude plugin validation | Pass. |
| `npm run probe:installed-plugin` | Pass: correlated `docs/design.md` read request and result verified before the terminal result. |
| `npm run smoke:trigger-selection` | Pass: explicit invocation returned the LoopSpine receipt; the same non-invoked readback returned the exact plain response; tracked state stayed unchanged. |

The sealed run was not repeated to search for a favorable sample. A future
behavior-changing candidate must rerun the frozen-baseline gate and pass on its
own recorded evidence.

## Stop Decision

This audit does not promote LoopSpine globally. All ten dogfood tasks now have
commit-pinned HTTPS proof references in the canonical register, with `100.0%`
verified completion, `0.0%` Sawyer intervention, a `4.22 min` median time to
proof, and a `30.0%` incorrect-stop rate. The pilot therefore fails the
no-unresolved-incorrect-stop gate in addition to the recorded frozen-baseline
sealed comparison.

The useful donor outcome is narrow: retain the two evals, immutable-proof
recorder, plugin/access probes, and explicit local invocation path. Do not add
hooks or permanent role agents. A later candidate should improve red-capable
debugging and completion consistency first, then clear the retained evals and
a fresh three-sample frozen-baseline comparison before global adoption is
reconsidered.
