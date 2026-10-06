---
title: Build Plan
type: plan
status: active
summary: The skill's phases — v2.1–v2.4 done, Phase 3 (verification + reach) next; what comes next is never the agent's call
tags: [plan,roadmap,phases]
updated: 2026-10-06
verified_at: 080a7adb7826
---

# Build Plan

## TL;DR

- Phases 1–2 are shipped (v2.0 wiki + v2.1 dynamic/delegating + v2.2 one-command + v2.3 teams/growth + v2.4 self-installing). Current work: Phase 3.
- Scope (WHAT) stays separate from tooling (HOW): the CLI can grow features without the method docs changing.
- New ideas discovered during a build get appended here first — then specced — never silently implemented.

## Phase 1 — the wiki foundation (COMPLETE — v2.0/v2.1)

- Compiled-knowledge architecture, router index, page format, staleness from git, hooks, task ledger, profile detection, tool delegation. See CHANGELOG.

## Phase 2 — one command, teams, self-install (COMPLETE — v2.2–v2.4)

- `ctx setup` idempotent + upgrade-safe; path-gated rules; agent memory; Lessons; danger zones; multi-user collision lint; `ctx archive`; `ctx install` from a GitHub link; dogfood (this repo's own wiki).

## Phase 3 — verification and reach (CURRENT)

- Phase 3 Feature 05: evals runner — make `references/evals.md` executable: a cold-start script that answers questions from the wiki only and diffs against ground truth → spec: feature-specs/05-evals-runner.md
- Phase 3 Feature 06: hook parity beyond Claude — wire SessionStart/Stop equivalents for Codex/Cursor where the tool allows → spec: feature-specs/06-hook-parity.md
- Phase 3 Feature 07: `ctx query` filing — auto-scaffold a `type: query` page skeleton from a brief hit so reusable answers get written, not retyped → spec: feature-specs/07-query-filing.md
- Phase 3 Feature 08: opt-in project skills — `--skills` scaffolds security-review/deploy/release playbooks into the project's skills/ → spec: feature-specs/08-project-skills.md

## Rules

- One system boundary per spec; ledger unit = branch = owner (see references/multi-user.md).
- Every feature lands with tests in the same commit (the suite is the contract).
