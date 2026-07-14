# Ten-Task Dogfood Pilot

The pilot keeps LoopSpine explicit and local. It does not install or rewrite any
global skill, profile, hook, or agent configuration.

## Run A Task

1. Choose a real task with an observable proof gate.
2. Invoke LoopSpine explicitly from this clone or a repo-local skill link.
3. Let the agent continue until proof or a named stop condition.
4. Save the completed run using `dogfood/completed-run-template.json`. Every
   proof reference must use an HTTPS URL pinned to the full commit that was
   inspected.
5. Record it:

```bash
npm run dogfood:record -- /path/to/completed-run.json
```

Public proof references are checked with an HTTPS `HEAD` request. A full-SHA
GitHub commit URL in a private repository may fall back to the authenticated
`gh api` session; if neither check succeeds, recording stops before any report
or register file is written.

Do not mark a task verified from the agent's prose alone. Use a test, screenshot,
runtime readback, PR check, or other exact receipt.

## Four Metrics

- **Verified completion rate:** completed tasks with passing external proof.
- **Sawyer intervention rate:** completed tasks that required at least one
  mid-run decision or correction from Sawyer.
- **Median time to proof:** elapsed minutes from execution start to passing proof.
- **Incorrect-stop rate:** completed attempts where the agent stopped despite a
  useful authorized next action remaining.

The report shows progress immediately but keeps performance rates `Pending`
until at least three real tasks are recorded. No synthetic demo or benchmark
case counts toward the ten-task pilot.

## Promotion Gate

Consider a narrow entry-skill promotion only after all ten tasks are recorded,
verified completion is at least 80%, intervention rate is at most 20%, and no
incorrect stop reflects a weakened proof or approval boundary. Runtime and
quality still require human review even when the four headline numbers pass.
