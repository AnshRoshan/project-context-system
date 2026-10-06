# Memory

Session handoff. Updated at the end of EVERY session. This file is how any agent or human picks up with zero re-explaining. Keep it under ~60 lines — history belongs in context/log.md.

_Last updated: 2026-10-06, end of the v2.2–v2.4 + dogfood session_

## Current state

The skill is at v2.4 (metadata 3.4.0): `ctx setup` is the one-command install path (profile detection, rules, agent memory, brownfield map draft, doctor), `ctx install` ships the skill from a GitHub clone, task ledger + merge-collision lint + `ctx archive` rotation are in. 47/47 self-tests pass. This repo now runs its own context system (that's what you're reading).

## Next step

No unit In progress. Pick from `context/progress-tracker.md` Up next (top item: evals runner). Add the spec first: `node context/ctx.mjs new feature <name>`, then `ctx task add` + `task start`.

## Working set (for compaction / resume)

- Current unit: none
- Files that matter: `scripts/ctx.mjs` (the CLI), `assets/` (templates), `references/` (deep docs), `tests/run.mjs` (the contract)
- Pages to read first: context/architecture.md, context/code-standards.md, context/decisions.md
- Commands: `node tests/run.mjs` (all) · `node tests/run.mjs <filter>` (subset) · `node context/ctx.mjs lint`

## Open questions

- Should `ctx install` also write the tool's hook config (Claude settings) automatically, or stay skill-copy-only? (unresolved, low urgency)

## Context debt

- `context/codebase/map.md` covers the 2 JS files only; markdown layers (references/assets) are described in architecture.md instead — acceptable at this size.
- `docs/` (human-facing) has only the README split-rule page; a real user-guide is unwritten.
