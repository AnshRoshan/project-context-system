# Changelog

## v2.4.1 — prompt craft: ASD-STE100 inside the system

- **`references/prompt-craft.md`**: the aerospace Simplified Technical English standard (ASD-STE100) adapted for LLM readers — one action per sentence, one word one meaning, named actors, exact numbers, results not negations, logical order = execution order. Applied to the prompts the system emits: feature specs, subagent briefs, clarify questions, Lessons, TL;DRs.
- Wired in: feature-spec template carries the discipline inline; SKILL.md PLAN step + references table; workflow-rules session bullet. Scope rule: new/edited text only — no mass rewrites.

## v2.4 — self-installing from a link, repo/skill boundary made explicit

**Added**
- **`ctx install`** — the skill's own installer: clone the repo, run one command, the skill lands in the detected tool home (`~/.claude/skills`, `~/.qoder/skills`; `--tool`/`--dest` to steer). Ships only `SKILL.md` + `references/` + `assets/` + `scripts/`; re-runnable, overwrite-clean.
- **GitHub-link flow** in README/INSTALL: paste the repo URL to any agent with one sentence and it installs + sets up the repo itself.
- **Repo-boundary section** (README): what stays in the dev repo (CHANGELOG, tests, plugin metadata), what installs as the skill, what lands in the scaffolded project — each half enforced by a test (no lineage in the project copy; no dev history in the install).

## v2.3 — teams, growth, and a clean room

**Added**
- **Multi-user support** (`references/multi-user.md`): one unit = one branch = one owner; per-unit files (specs, module pages, sources) keep parallel work conflict-free; per-person files already gitignored. **Merge-collision detection in lint**: Feature id twice in one tracker section (ERROR), two specs sharing a number (WARN), `ctx task add --spec` refuses claimed numbers. Verified end-to-end with a two-branch merge simulation.
- **`ctx archive`** — the growth valve: log entries older than `archiveAfterDays` (180) and tracker completions older than `trackerKeepDays` (90) rotate into dated, still-greppable `context/archive/` files with a pointer left behind; `--dry-run`; prints the year-split plan when `decisions.md` outgrows its page budget. Nothing is ever deleted, only moved off the hot path.
- **No-leak guarantee**: the CLI copy installed into a project carries no skill lineage (version chatter, attributions) — templates and the copied header ship neutral; covered by a test.

## v2.2 — one command, and the repo keeps learning

**Added**
- **`ctx setup` — the single setup command**, greenfield or brownfield: profile detection + full scaffold + path-gated rules + subagent memory + a `codebase/map.md` **drafted from the real file census** (directory counts, manifest entry points, candidate module globs, `confidence: inferred`) + `ctx index` + 12-point `ctx doctor`. **Idempotent** (filled content never clobbered) and **upgrade-safe**: re-run after updating the skill — it refreshes `context/ctx.mjs` only when changed, adds new files, bumps `setupVersion`; `doctor` now FAILs stale projects and names the fix.
- **Path-gated rules**: `.claude/rules/{frontend,api,data,testing}.md` generated per profile — `paths:` globs that load the right wiki pages only when the agent touches matching files. `ctx rules <file>` answers "what applies HERE" (rules + covering pages + nested AGENTS.md up the tree). Rules are pointers; knowledge stays in `context/`.
- **Subagent memory**: `context/agents/<name>/MEMORY.md` — explorer and reviewer read theirs first, append ≤3 dated one-liners per run. Agent experience becomes version-controlled infrastructure (excluded from the page set; doctor checks it's wired).
- **`AGENTS.md §Lessons`**: the self-improving section — every human correction becomes one "When X, do Y" line, newest on top, ≤20 lines; workflow-rules gained the matching recording duty.
- **Danger zones**: `setup --danger "src/auth,src/payments"` drops a nested AGENTS.md where the landmines are — warnings at the moment of danger.
- **Relative-path discipline**: setup runs from the project root (`node <skill-dir>/scripts/ctx.mjs setup` — no `--root`); the AGENTS.md invariant "paths and commands are project-relative, never machine-specific"; `ctx lint` now WARNs on absolute paths (`C:\Users\…`, `/home/…`) in any wiki page.
- `.claude/settings.local.json` gitignored; `ctx --version`; `setupVersion` tracked in `.ctx.json`.

**Rationale** — audited against the "Final Boss" / agent-kit setups circulating in 2026: kept the genuinely new ideas (context ladder rung 2 = path-gating, agent memory, lessons-from-corrections, danger-zone files), skipped the personal-assistant memory tree and workflow scripts (not codebase context; bloat).

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
