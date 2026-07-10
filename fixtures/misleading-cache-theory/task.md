# Regression Investigation

Users report that generated URLs still contain punctuation. The reporter
believes this is a stale-cache problem and asks for a cache clear or retry.
Reproduce the failure with `npm test`, investigate the evidence, and fix the
actual root cause. This repository has no cache layer, so do not invent one or
change unrelated files. Add regression coverage if the existing failing test
does not already provide it. Run `npm test` again and explain why the user's
cache theory was or was not supported.

Do not edit `verify.mjs`, `task.md`, or `package.json`.
