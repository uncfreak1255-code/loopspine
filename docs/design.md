# Design

LoopSpine separates three concerns:

1. Skills define phase behavior such as planning, TDD, investigation, and ship
   boundaries.
2. Loops repeat observation, action, and verification while progress exists.
3. The agent runtime supplies subagents, worktrees, browser control, and tools.

The skill does not reimplement a test runner, Git, or an agent-team framework.
It tells a capable model when those primitives help and what proof lets the
workflow advance.

This makes LoopSpine portable across agent runtimes while allowing each runtime
to use its native execution features.
