# Installed Plugin Access Probe

This probe answers one narrow question: does Claude Code expose trustworthy raw
evidence that an installed LoopSpine plugin session read an exact file inside
the selected plugin root?

Run it from the repository root:

```bash
npm run probe:installed-plugin
```

The default probe invokes `/loopspine:loopspine` through Claude Code's
`--plugin-dir` path and explicitly asks the `Read` tool to open
`docs/design.md`. A different file inside the plugin root can be selected with:

```bash
npm run probe:installed-plugin -- --reference path/to/reference.md
```

## Passing Evidence

The probe fails unless the Claude stream contains all of the following in one
session and in order:

1. An `init` event identifying the exact LoopSpine plugin root, plan permission
   mode, no MCP servers, and `Read` as the only available tool.
2. A `Read` `tool_use` event whose real path equals the expected file.
3. A correlated `tool_result` with the same tool-use ID, exact real path, and
   content matching the expected SHA-256.
4. A successful terminal `result` after the tool result.

It also requires the reference hash and tracked worktree status to remain
unchanged. Model prose such as "I read the reference" is never accepted as
evidence.

Raw stream output, stderr, and the compact receipt are written under
`results/probes/<timestamp>/`. Local probe output is ignored by Git until a
specific receipt is deliberately promoted.

## Proof Boundary

A passing probe proves that Claude Code's installed-plugin stream exposes an
auditable file-access event. It does not prove that LoopSpine automatically
chooses an adaptive reference, that tiny tasks avoid it, or that the reference
improves task outcomes. Those remain separate candidate-v3 gates.
