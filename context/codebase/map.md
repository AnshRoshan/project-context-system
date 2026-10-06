---
title: Codebase Map
type: architecture
status: active
summary: The repo's two code files and the markdown layers around them — where each behavior actually lives
tags: [map, structure, entry-points]
covers: [scripts/ctx.mjs, tests/run.mjs]
related: [architecture.md]
updated: 2026-10-07
confidence: verified
verified_at: d5ff854c4cf9
---

# Codebase Map

## TL;DR

- Stack: one Node file (the CLI) + one Node test file; everything else is markdown. Entry point: `scripts/ctx.mjs` (argv dispatch over the `commands` object).
- Source: `scripts/`; tests: `tests/run.mjs`; generated-by-tooling: nothing (no build step).
- <10 source files → per the granularity rule there are no module pages; this map + architecture.md carry it.

## Annotated tree

```
SKILL.md              the router agents load (mode table, bootstrap, core loop, recording table)
scripts/ctx.mjs       the entire CLI: args → commands.{setup,init,task,lint,doctor,impact,stale,brief,rules,index,coverage,log,stamp,new,status,detect,tools,archive,hook,install}
  ├ utils/frontmatter glob engine         parseFrontmatter / globToRegex / matchers — shared by every command
  ├ pages()/sourceFiles()/staleReport()   the wiki's read model over context/ + git
  ├ detect() + DEP_MARKERS + INTEL_TOOLS  profile detection and delegation-tool probing (setup/init read it)
  └ commands.*                            each subcommand; emit() wraps human/JSON output ({command, ok})
references/           deep playbooks, one per operation (ctx-cli.md documents every flag)
assets/               templates for every scaffolded file; *.template suffix stripped on copy
tests/run.mjs         self-test: sandbox() builds throwaway git repos, ctx() drives the copied CLI
```

## Entry points

| Kind | File | Notes |
|---|---|---|
| CLI | `scripts/ctx.mjs` | `node scripts/ctx.mjs <command>`; help text is the file's own header comment |
| bin | package.json `bin.ctx` | same file |
| Test | `tests/run.mjs` | `node tests/run.mjs [filter]` |

## Where is X?

| I need to… | Go to |
|---|---|
| change scaffold behavior / add a shipped file | `commands.init` + `INIT_MAP` in scripts/ctx.mjs, template in assets/ |
| change profile detection | `detect()` / `DEP_MARKERS` / `MANIFEST_LANG` |
| add a lint rule | `commands.lint` (+ document in references/ctx-cli.md, test in tests/run.mjs) |
| change task-ledger states | `commands.task` + `TASK_SECTIONS` + tracker template |
| edit what agents are told | SKILL.md (router) or references/*.md (depth) — never both |
| ship a new file into projects | assets/*.template + INIT_MAP entry with a profile predicate |

## Generated / do-not-edit

- `context/ctx.mjs` (a copy — refresh via setup), the catalog block between `<!-- ctx:index:* -->` markers in context/index.md, `.kilo/worktrees/` (stale editor worktree, untracked, ignore).
