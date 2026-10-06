# Changelog

## v2.1 — dynamic, delegating, self-honest

**Added**
- **Project-profile detection** (`ctx detect`, used by `init`): manifests → languages, kinds (web-app/api/cli/library/mobile/data/docs/monorepo), UI/DB/backend signals; scaffold files, pointer files and `.ctx.json` (`sourceExt`, ignore globs) are all chosen from the profile — a Python API no longer gets Next.js-flavored pages, and any repo works without flags. Overrides: `--ui/--no-ui`, `--full`, `--no-detect`, `--pointers`.
- **Task ledger** (`ctx task add|start|block|done|list`): In progress (max one — enforced) / Blocked (why + unblock required) / Up next / Completed (concrete details required); lint now checks three-way state exclusivity and that every tracked unit has a spec.
- **Delegation** (`ctx tools`, `references/tool-delegation.md`): detects graphify, ctags, aider, dependency-cruiser, madge, tree-sitter, go/cargo toolchains; the skill now says "the tool produces, the wiki keeps" instead of hand-rolling code maps.
- **Scaffold expanded**: `docs/` (human-facing docs, split rule vs `context/`) and `.claude/agents/context-explorer.md` + `context-reviewer.md` (read-only subagents).
- **CLI contract delivered**: `doctor` (wiring checks), `--json` on lint/status/stale/coverage/impact/doctor/task/detect/tools (`{command, ok, …}`), `lint --fix`, decision-record completeness, spec-complete-with-unticked-checks, tracker-unit-without-spec, `brief` BLIND SPOT, compaction-aware SessionStart hook, init refuses to run without `assets/` — all previously specified by the test suite but missing from the CLI (15 red tests → green).

**Fixed**
- `git()` trimmed leading whitespace, shifting ` M path` porcelain lines to `rc/path` and silently breaking `impact`/`stale`/`stamp` glob matching; CRLF is now normalized without trimming, and quoted/renamed paths parse intact.

**Removed**
- `assets/ctx.config.json.template` — `.ctx.json` is now generated from the detected profile.

## v2.0 — LLM-wiki edition

Rebuilt around Karpathy's LLM-Wiki pattern (raw → wiki → schema; ingest/query/lint; index.md + log.md) with software-specific additions, and tooling that enforces it.

**Added**
- `scripts/ctx.mjs` — zero-dependency CLI: `init brief impact stale lint index coverage log stamp new status hook`.
- **Router**: `context/index.md` (task-routing table + generated catalog of every page) replaces "read 4 files always". Orient cost ≈ 2–5k tokens.
- **Progressive disclosure**: page `summary` (L0) → `## TL;DR` (L1) → page (L2) → code (L3); token budgets; `ctx brief` ranks pages by file/keyword with token cost.
- **Page spec**: required frontmatter (`title type status summary updated`, `tags covers related confidence verified_at superseded_by`).
- **Codebase wiki**: `codebase/map.md`, `codebase/modules/*.md` with `covers:` globs; ADOPT procedure for existing repos using parallel read-only subagents; `ctx coverage` finds blind spots.
- **Update-on-change**: `ctx impact` maps changed code → pages to update; git-based `ctx stale`; Stop hook blocks session end when covering pages/tracker/memory weren't updated (loop-safe).
- **Timeline**: `context/log.md` append-only, greppable (`## [date] op | title`).
- **Ingest**: `context/raw/` (immutable) → `context/sources/` summaries → affected pages, contradiction handling.
- **Confidence & provenance**: `verified | inferred | unverified`, conflicts flagged not overwritten.
- New knowledge pages: data-model, api-contracts, glossary, integrations, env-vars, testing, runbook.
- `llms.txt` generation, multi-tool pointer files (GEMINI, Copilot, Cursor), optional pre-commit hook, hierarchical indexes for 150+ pages.
- Evals: cold-start test, task-start benchmark, continuous health signals.
- `memory.md` gained working set + context debt.

**Changed**
- `AGENTS.md` template is a schema: orient → route → maintain-the-wiki table; shorter and routed through the index.
- `SKILL.md` is a lean router with mode detection (SETUP/ADOPT/RUN/INGEST/QUERY/SYNC/LINT/HANDOFF/COMPACT).
- `workflow-rules` gained "Context maintenance" rules and lost a duplicated bullet.
- `settings.json` template adds hooks and denies edits to `context/raw/**`.

**Kept** (from v1, intact): the five-course discipline — planning conversation, build shapes, spec loop, clarify + value-source gates, decision records with honest lost alternatives, error protocol, one-session-per-unit, safety/permissions model, architecture escalation ladder.
