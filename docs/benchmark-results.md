# Benchmark Results

## Accepted Candidate: v0.2.0

The release skill and independently authored seal were frozen before scoring:

- skill SHA-256:
  `5f58a9f74a57569f3554e33d24508464ede7bb50589a5eb24e38073fe2d905a6`
- sealed v2 SHA-256:
  `e3845f85a38e835b8428f4770862ba4b12daea2d032f633ded025aa2d17d7d5c`

The sealed A/B used `gpt-5.5`, six cases, three samples per case, deterministic
randomized variant order, and 36 fresh ephemeral sessions.

| Measure | No skill | LoopSpine | Delta |
|---|---:|---:|---:|
| Weighted quality | 75.16% | 96.73% | +21.57 points |
| Strict sample pass rate | 22.22% | 72.22% | +50.00 points |
| Boundary violations | 0 | 0 | 0 |
| Median runtime | 12,273.5 ms | 13,335 ms | +8.65% |
| Median output size | 1,904 bytes | 2,011.5 bytes | +5.65% |

Receipt:
`results/2026-07-10T23-11-45-099Z-gpt-5.5-sealed-only/comparison.json`

## Execution Trajectories

Three disposable repositories test actual work, not workflow description:

- a parser behavior change must modify implementation and add a focused test;
- a regression must be reproduced and root-caused despite a misleading user
  theory;
- a documentation heading/link repair must stay scoped and pass an independent
  link check.

Both the control and LoopSpine completed all three, for six passing trajectories
with exact diffs, agent outputs, tests, and independent checks preserved.

Receipt: `results/trajectories/2026-07-10T23-22-09-285Z/summary.json`

## Rejected Candidate: v0.1.0

The first sealed candidate was rejected. It improved strict passes and won
13/18 blind Sol comparisons, but gained only 7.8 weighted points and exceeded
the output target at 28.35%; the blind reviewer did not justify that overhead.
The failed receipt remains under
`results/2026-07-10T22-52-27-414Z-gpt-5.5-sealed-only/`.

## Limits

- The quantitative A/B measures workflow decisions with a conservative
  semantic scorer; fixture trajectories provide the execution layer.
- Numbers are confirmed for the recorded model and environment, not every model
  or repository.
- Claude Fable has a plugin-load and behavior smoke test, not a comparative
  performance benchmark. Raw stdout, exit status, versions, and hashes are in
  the [portability receipt](../results/portability/claude-fable-v0.2/receipt.json).
- These results support release readiness, not a promise of GitHub popularity.
