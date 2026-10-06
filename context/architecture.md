---
title: Architecture
type: architecture
status: active
summary: The skill's four layers (router, deep docs, templates, CLI), the shipping boundary, and the invariants every change must hold
tags: [architecture,stack,invariants]
covers: [scripts/**, assets/**, references/**, tests/**, SKILL.md]
updated: 2026-10-07
verified_at: d5ff854c4cf9
---

# Architecture

## TL;DR

- Four layers: `SKILL.md` (router the agent loads) → `references/*.md` (deep playbooks) → `assets/*` (templates copied into projects) → `scripts/ctx.mjs` (the zero-dep CLI). `tests/run.mjs` pins the CLI's contract.
- The CLI is one file, no imports beyond node builtins + git. It writes into OTHER repos — so every path it emits is project-relative.
- Three boundaries, each test-guarded: dev repo ⊄ installed skill ⊄ scaffolded project.

## Tech stack — tool and its role

| Tool | Version | Role | Why |
|---|---|---|---|
| Node | ≥ 18, builtins only | the CLI runtime | zero-dep = installs anywhere, never rots |
| git CLI | any recent | staleness/impact detection via porcelain + diff | the project already has it |
| Markdown + YAML frontmatter | — | the wiki format | agents read it natively; humans review diffs |

No frameworks, no dependencies — see D-01 in decisions.md.

## Folder structure

- `SKILL.md` — lean router (~130 lines): mode table, bootstrap, core loop, recording table. Detail lives in references.
- `references/` — one playbook per operation (operations, codebase-wiki, tool-delegation, multi-user, ctx-cli, page-format…).
- `assets/` — every file the scaffold creates has a template here (`.template` suffix stripped at write time; `{{PLACEHOLDER}}` = agent judgement, `{{TODAY}}` = CLI-substituted).
- `scripts/ctx.mjs` — the CLI; `init` copies it to the project's `context/ctx.mjs`.
- `tests/run.mjs` — self-test harness: throwaway git repos + real CLI invocations, no framework.
- `docs/` — human-facing docs (see docs/README.md for the split rule); `context/` — this repo's own wiki.

## System boundaries & data flow

Profile detection (`detect()`) drives everything: manifests → langs/kinds/signals → which templates init writes, which rules generate, what `.ctx.json` seeds. `setup` = init → map draft → index → doctor. The CLI never edits project CODE — only `context/`, `docs/`, `AGENTS.md` and friends.

## Invariants — rules the system must never violate

- `scripts/ctx.mjs` stays zero-dependency (node builtins + git only).
- Anything written INTO a project carries no repo dev history (no version chatter, no lineage) — tests enforce at both boundaries.
- All paths in output, docs and generated files are project-relative; the only external reference is the skill dir in the one-time setup command.
- `init`/`setup` never overwrite filled content; upgrades add files and bump `setupVersion` only.
- Every CLI behavior change ships with a test in the same commit (the suite IS the contract).
- git output is parsed positionally — normalize CRLF, never `trim()` porcelain lines (see Lessons).
- SKILL.md stays a router (~130 lines); depth goes in references, never inline.

## External dependencies

None at runtime. graphify/ctags/aider are *optional delegation targets* the CLI probes for (`ctx tools`) — absence degrades to the manual procedure, never breaks.
