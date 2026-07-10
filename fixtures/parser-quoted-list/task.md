# Parser Task

`parseList` currently handles simple comma-separated values. Change it so a
quoted value may contain a comma, while preserving the existing trimming
behavior. For example, `parseList('"red, blue",green')` must return
`['red, blue', 'green']`.

Work end to end: inspect the code, add a focused regression test for the
quoted-comma behavior, implement the smallest fix, and run `npm test`. Do not
edit `verify.mjs`, `task.md`, or `package.json`.
