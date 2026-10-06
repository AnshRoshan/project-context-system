---
title: Library Docs
type: guide
status: active
summary: The only "libraries" here are node builtins and the git CLI — with the sharp edges already learned
tags: [libraries,dependencies,docs]
updated: 2026-10-06
verified_at: 080a7adb7826
---

# Library Docs

## TL;DR

- Zero dependencies by policy (D-01): node builtins (`fs`, `path`, `os`, `child_process`, `url`) + the `git` CLI. Adding an npm dep requires a decision record and a very good reason.
- Git parsing has the two known traps already handled: CRLF output, and porcelain lines starting with a status-column space.

## Installed agent skills / MCP servers

| Tool | Where it comes from | When to load it |
|---|---|---|
| `graphify` skill | installed in this machine's agent | any question about THIS repo's structure — it indexes repos; `ctx tools` detects it |
| `skill-creator` | agent built-in | editing SKILL.md's structure/description |

## Per-library usage notes

### git (via execFileSync)
- Called only through `git()` in `scripts/ctx.mjs`: CRLF-normalized, trailing-whitespace-stripped, NEVER `.trim()` (porcelain lines start with a space — trimming shifted paths one char and silently broke impact/stale; regression test exists).
- `status --porcelain -uall` must be ONE argv token (`-u all` as two args makes `all` a pathspec).
- Windows: `where` not `which` for bin probes.

### node builtins
- `execFileSync` with `stdio: ['ignore','pipe','ignore']` everywhere — a hook reading fd 0 synchronously can hang forever; see the stdin no-hang test.

## Known operational gotchas

- This repo's `.kilo/worktrees/super-raincoat/` is a stale v1 editor worktree (untracked) — never edit or copy from it.
- `git ls-files` output is forward-slash on all platforms; keep `posix()` at the boundaries, don't "fix" it.

## Docs sources

- Claude Code hooks/settings schema: `https://json.schemastore.org/claude-code-settings.json` (referenced in the template) — re-read before changing hook wiring.
