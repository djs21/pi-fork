# Agent Instructions

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

- Use `sbeads` for ALL task tracking — do not use TodoWrite, TaskCreate, or
  markdown TODO lists.
- Mutate only through the CLI (`sbeads update`, `sbeads reopen`, `sbeads delete`,
  `sbeads dep add|rm`). Never edit the SQLite database directly.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## Build & Test

```bash
bun test                    # Full suite (fast)
node --test 'test/**/*.mjs' # Same suite under Node
pi -e .                     # Manual check: load the extension in Pi
```

`test/runInProcess.test.mjs` is hermetic (empty temp workspace + one fixture
extension via `additionalExtensionPaths`), so it passes under both runners.

## Commit Policy

Do not commit or push unless explicitly asked. At handoff, report changed files,
validation results, and the exact commands you suggest running.
