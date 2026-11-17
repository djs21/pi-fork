# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Task Tracking (sbeads)

This repository uses **sbeads** — a lightweight SQLite-backed issue tracker — for
task tracking and multi-agent coordination.

```bash
sbeads ready                              # Unblocked tasks
sbeads show <id>                          # Task details and dependency edges
sbeads claim <id> --agent <name>          # Claim before working
sbeads unclaim <id>                       # Release if aborted or blocked
sbeads close <id>                         # Close after tests pass
```

Use `sbeads` for all task tracking; do not create markdown TODO lists. Mutate only
through the CLI — never edit the SQLite database directly.

## Build & Test

```bash
bun test                    # Full suite
pi -e .                     # Manual check: load the extension in Pi
```

`node --test` currently hangs on `test/runInProcess.test.mjs`, which loads the
real `~/.pi/agent` extensions. Use `bun test`.

## Architecture Overview

`pi-fork` is a Pi extension that exposes one `fork` tool. The parent snapshots its
active session branch, hands it to a child worker, and returns a dense report.

- `src/index.ts` — tool registration, session snapshot, cost footer
- `src/config.ts` — `pi-fork` settings (extensions, tools, runtime, effort, childPrompt)
- `src/runFork.ts` — picks the runtime, then delegates
- `src/runInProcess.ts` — default runtime: `createAgentSession` in-process (fast, ~0.1s)
- `src/runSubprocess.ts` — isolated runtime: spawns a real `pi` process
- `src/runner-cli.js` — which parent CLI args are inherited by the child
- `src/runner-events.ts`, `src/types.ts`, `src/cost.ts`, `src/render.ts` — event
  mapping, result shape, cost aggregation, TUI rendering

Children do not inherit the parent system prompt; `childPrompt: "stock"` (default)
gives them Pi's built-in prompt so a fork does not try to delegate further.

## Conventions & Patterns

- `src/runner.ts` duplicates the subprocess path in `src/runSubprocess.ts`
  (`buildPiArgs`, `runFork`). Both are patched in parallel — keep them in sync or
  collapse them deliberately.
- Tests are `.mjs` files importing `.ts` sources directly; run them with `bun`.
