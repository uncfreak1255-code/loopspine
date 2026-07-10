# Benchmark Revisions

## Revision 1: remove answer leakage before the full run

Pilot 1 tied at 93.48% because both variants were explicitly told to return
LoopSpine's route, loop, approval, and proof fields. That injected much of the
candidate behavior into the no-skill baseline.

The inherited Sawyer eval pack also accepted only `spec` or `autoplan` for a
fuzzy planning case, while portable LoopSpine names that lane `plan`.

Before any full or held-out acceptance run:

- Both variants now receive the same natural scenario and “explain your
  workflow” request.
- The scorer checks semantic behavior and route choice without requiring the
  candidate's answer schema.
- Portable `plan` is accepted alongside environment-specific planning tools.
- No safety, held-out, or stopping assertion was removed.

This is the one allowed harness revision. Further failures change the skill,
not the benchmark.

## Revision 2: replace the invalid held-out claim

An independent release audit found that the four cases originally labeled
`held-out` were not genuinely untouched: one appeared in the pilot and one
route assertion changed during harness correction. They are now labeled
`development` and remain as regression coverage, but no release claim may use
them as held-out evidence.

After the skill body was frozen, an independent agent that was prohibited from
reading the skill authored `evals/sealed-v1.json`. The seal records:

- frozen skill SHA-256:
  `0d08ae3461b4d581260c9c78d10e200a1f290c773999ed97807ad55db4edddc3`
- sealed eval SHA-256:
  `ff318d2b904cc204727ec01110b0aa72b8b72658a6c81bc469704fab09ce99d8`
- six cases authored by `independent-terra`

The skill body may not change after unsealing these cases. A failure blocks this
release candidate instead of starting another tuning pass against the same
cases.

## Revision 3: v0.1 rejected, v0.2 challenger opened

The sealed v1 comparator rejected v0.1. It improved strict sample pass rate from
50% to 77.78% with no boundary violations, and a blind Sol judge preferred it
in 13 of 18 pairs, but weighted gain was 7.8 points and the judge did not
justify 28.35% output overhead.

The v0.2 challenger keeps the same safety and proof requirements while making
three general corrections:

- direct verification skips plan ceremony and does not assume edit authority;
- retry-only tasks do not insert unrequested repairs;
- loop packets stay internal unless their detail is useful to the user.

Sealed v1 is retired from release acceptance and remains immutable historical
evidence. v0.2 requires a new independently authored seal before evaluation.

Sealed v2 was authored by an independent Terra agent that could inspect only
the development eval schema. Before unsealing, the release hashes were:

- frozen v0.2 skill SHA-256:
  `5f58a9f74a57569f3554e33d24508464ede7bb50589a5eb24e38073fe2d905a6`
- sealed v2 eval SHA-256:
  `e3845f85a38e835b8428f4770862ba4b12daea2d032f633ded025aa2d17d7d5c`

No skill changes are allowed after this seal is opened.

## Revision 4: reject negated forbidden-phrase false positives

The first v0.2 score marked “I would not ... blame the vendor” as a boundary
violation because the scorer searched for the exact phrase without considering
negation. This is the false-positive mode identified by the independent v0.1
audit before sealed v2 existed.

The scorer now ignores a forbidden phrase when its sentence clearly negates the
behavior. The same saved model outputs are rescored; the skill, seal, sample
count, and acceptance thresholds remain unchanged.

## Revision 5: close two pre-commit harness gaps

Structured autoreview found that `without approval, deploy` could be mistaken
for negation and that blind-review preparation still selected sealed v1 prompts.
The matcher no longer treats `without` as action negation, with a focused unsafe
deployment test. Blind preparation now loads the sealed file named and hashed in
run provenance and fails if any scenario is missing. The frozen v0.2 outputs are
rescored after this correction.

## Revision 6: make sealed v2 the runner default

Structured rereview found that direct `--sealed` or `--sealed-only` commands
still defaulted to retired sealed v1 even though the release npm command passed
v2 explicitly. The runner now defaults to sealed v2 and the `loopspine-v2` seed;
historical v1 reproduction remains available through explicit flags.

## Revision 7: scope negation and bind blind prompts to the seal hash

Structured rereview found that unrelated negation earlier in a sentence could
hide an affirmative forbidden action, and that blind preparation selected the
provenance path without verifying its recorded SHA. Negation is now recognized
only when it directly precedes the action or scopes an `or`-coordinated list,
with adversarial conjunction tests. Blind preparation now fails unless the
sealed prompt file matches run provenance exactly.

## Revision 8: tokenize routes and load every provenance eval source

Structured rereview found that substring route scoring could accept `qa` inside
`quality`, and that blind preparation supported sealed-only runs but not combined
development-plus-sealed runs. Route labels now use exact token boundaries and
prefer an explicit `ROUTE:` field when present. Blind preparation verifies and
loads every eval file named in provenance before pairing any output.

Rescoring the frozen outputs with token-aware routes changed the baseline from
80.39% to 75.16%, left LoopSpine at 96.73%, and increased the accepted weighted
delta from 16.34 to 21.57 points.
