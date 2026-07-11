# Narrow Integration

LoopSpine should become the entry skill for serious coding work, not a
replacement for every specialist skill.

```text
intent
  -> LoopSpine chooses the lane and owns the bounded loop
     -> planning specialist for fuzzy or consequential scope
     -> TDD/build tools for behavior changes
     -> investigate/debug tools for failures
     -> QA/browser tools for live behavior
     -> review/autoreview before landing
     -> ship tools for commit, push, and PR
     -> deploy tools only after explicit production permission
  -> LoopSpine reads back proof and returns one receipt
```

## Pilot Without Global Installation

Use an explicit invocation from the clone:

```text
$loopspine handle this task end to end and stop only at proof or a named boundary
```

Or link the skill into one test repository only:

```bash
mkdir -p .agents/skills
ln -s /absolute/path/to/loopspine/skills/loopspine .agents/skills/loopspine
```

Do not copy the planning, debugging, QA, review, ship, or deploy specialists into
LoopSpine. It owns lane selection, continuation, stopping, integration, and the
final receipt; specialists retain their existing domain logic.

Global promotion remains a separate approval boundary after the ten-task pilot.
