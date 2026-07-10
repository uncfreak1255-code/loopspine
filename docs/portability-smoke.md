# Portability Smoke

## Claude Fable

On 2026-07-10, Claude Code `2.1.206` loaded the local LoopSpine plugin with
`--plugin-dir` and invoked `/loopspine:loopspine` using the `fable` model.

The v0.2 replay preserves raw stdout, stderr, exit status, CLI version, and the
skill and Claude-manifest hashes in its
[receipt](../results/portability/claude-fable-v0.2/receipt.json).

Scenario: compare an example config with its schema, make no edit unless a
mismatch is proven, and run with no tools exposed.

Observed contract:

- selected the `direct` lane;
- returned `blocked` instead of claiming an unrun check succeeded;
- named the unavailable read path as the exact blocker;
- preserved the no-edit boundary;
- returned the compact LoopSpine receipt fields.

This is an installation and behavior smoke test, not a comparative performance
benchmark. The command used no edit or execution tools and made no workspace
changes.

```bash
npm run smoke:claude-fable
```
