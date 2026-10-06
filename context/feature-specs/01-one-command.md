---
title: One-Command Setup
type: feature
status: complete
summary: v2.2 — ctx setup as the single idempotent, upgrade-safe entry point with rules, agent memory and Lessons
tags: [one-command, setup, v2.2]
covers: []
updated: 2026-10-06
verified_at: 080a7adb7826
---

# One-Command Setup (v2.2)

## TL;DR
- Goal: one command does everything mechanical, greenfield or brownfield; re-running never harms, upgrading is just re-running.

## What to build
`ctx setup` = init + path-gated `.claude/rules/` + `context/agents/*/MEMORY.md` + brownfield map draft + index + doctor; `setupVersion` stamping; Lessons section in AGENTS.md; `--danger` nested files; settings.local gitignored; relative-path discipline.

## Explicitly NOT in this spec
Auto-filling placeholders from guesses; auto-running graphify.

## Clarifications
User: "single start… once I use one command it sets up my whole repository whether it is greenfield brownfield".

## Verification checklist
- [x] setup passes doctor on greenfield AND brownfield sandboxes (tests)
- [x] second run creates nothing, clobbers nothing (test)
- [x] stale setupVersion FAILs doctor and setup heals it (test)
- [x] context pages updated (ctx impact shows no ✗)
