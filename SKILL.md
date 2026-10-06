---
name: project-context-system
description: Turns any project — any language, any shape (web app, API, CLI, library, mobile, data pipeline, docs, monorepo), greenfield or brownfield — into a self-maintaining markdown knowledge base (Karpathy-style LLM wiki - raw sources, wiki pages, schema) so coding agents (Claude Code, Codex, Cursor, Copilot, Gemini, Qoder) get project context from files instead of re-reading the codebase. One idempotent, upgrade-safe command sets everything up (ctx setup): auto-detects the project profile, scaffolds AGENTS.md, CLAUDE.md, memory.md, docs/, .claude/ (settings, path-gated rules, subagent definitions with their own memory), the full context/ wiki (router index, log, codebase map drafted from the real repo on brownfield, module pages, specs, decisions, task ledger), seeds config from the stack, and self-checks with doctor. Use at the START of a project, when adopting an EXISTING codebase, when the user asks to set up agent files, build a context system or LLM wiki, document a codebase for AI, restore state in a new session, ingest PRDs/notes/docs, manage the task ledger, sync or lint context, or hand a project to another agent. Delegates code intelligence to better tools (graphify, ctags, aider) when present; zero-dependency ctx CLI detects staleness from git and enforces updates.
---

# Project Context System (v2.4)

**Context is compiled, not retrieved.** The agent's understanding of the project is written once — at change time — into interlinked markdown pages, then read cheaply at task time. A fresh session, a teammate or a different AI tool orients from files in a few thousand tokens and never has to re-explore the repo or be re-told anything.

Five laws:
1. **Decide what to build first.** A line changed in a plan is free; a decision spread through the codebase is a rewrite.
2. **Make the hard calls on purpose.** Every addition gets an explicit cost recorded (`decisions.md`).
3. **Keep the state in files.** The agent updates them *while* working, every session — enforced by tooling, not goodwill.
4. **Never let the AI decide something important without telling the human.** Conflicts and gaps are flagged, never silently resolved.
5. **Read cheap, then deep.** index line → `## TL;DR` → full page → source code. Stop at the first level that answers.

Architecture (details: `references/llm-wiki-pattern.md`): **Raw** (code + `context/raw/`, immutable) → **Wiki** (`context/**` pages with frontmatter, agent-owned, human-reviewed) → **Schema** (`AGENTS.md` + `context/index.md` routing). Operations: **ingest · query · lint**, plus **update-on-change** (`ctx impact`). Navigation: `context/index.md` (catalog) + `context/log.md` (timeline).

## Mode detection

| Situation | Mode | Go to |
|---|---|---|
| New project, no `AGENTS.md` + `context/` | **SETUP** | Bootstrap below |
| Existing code, no wiki | **ADOPT** | `references/codebase-wiki.md` → Adopt procedure |
| Wiki exists, user starts work | **RUN** | ORIENT → BUILD (`references/operations.md`) |
| User drops PRD / notes / vendor docs / asks to "add this to the docs" | **INGEST** | `operations.md` §4 |
| User asks a question about the project | **QUERY** | `operations.md` §2 |
| Docs and code disagree / resumed after a break / `ctx stale` non-empty | **SYNC** | `operations.md` §7 |
| Multiple people/agents on branches / merge collision / files getting heavy | **MULTI-USER** | `references/multi-user.md` (+ `ctx archive`) |
| "Check the docs", phase boundary, pre-merge | **LINT** | `operations.md` §6 |
| Ending a session / switching agents | **HANDOFF** | `operations.md` §8 |
| Wiki feels big/noisy | **COMPACT** | `operations.md` §9, `context-routing.md` |

## Bootstrap (SETUP / ADOPT)

1. **Planning conversation (~10 min) before generating anything.** Human + a planning AI are the architect; the coding agent is the engine. Pin down: what it does, who uses it, core flows, complex/risky parts, what is in v1 and what waits. Choose a build shape: **facade** (UI first), **journey** (one full path), **skateboard** (thin slice through everything), **tracer bullet** (one risky path end to end). Goals concrete and measurable. Never generate context files from guesses.
2. **Scaffold — one command, ever:** run the skill's `scripts/ctx.mjs setup` **from the project root** (`cd <project> && node <skill-dir>/scripts/ctx.mjs setup [--danger "src/auth,src/payments"]`) — no `--root` needed there. That is the last time any path outside the project is referenced: everything after is project-relative (`node context/ctx.mjs …`). Setup detects the project profile (manifests → languages, kinds, UI/DB/backend signals, agent-tool dirs) and does **everything mechanical**: creates `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`), `CLAUDE.local.md`, `memory.md`, `.claude/{settings.json,rules/,agents/}`, `docs/`, the full `context/` wiki (router index, log, overview, architecture, build-plan, standards, workflow-rules, library-docs, decisions, task ledger, current-issues, codebase/, raw/, sources/, feature-specs/…), seeds `context/.ctx.json` from the stack, copies `context/ctx.mjs`, merges `.gitignore`, and on a **brownfield** repo drafts `codebase/map.md` from the real file census (entry points from the manifest, `confidence: inferred`). Path-gated `.claude/rules/*.md` load wiki pages only when the agent touches matching paths; `--danger` drops a nested AGENTS.md in landmine dirs. **Idempotent** (never clobbers filled content) and **upgrade-safe**: re-run after updating the skill — it refreshes the tooling, adds new files, bumps `setupVersion` (`ctx doctor` flags stale projects). Preview with `ctx detect`; flags `--ui/--no-ui`, `--full`, `--pointers`. Tree and purpose of each file: `references/context-files.md`.
3. **Fill the templates from the planning conversation.** Replace every `{{PLACEHOLDER}}`; delete sections that don't apply (an honest 30-line page beats a padded 200-line one). Facts the agent can't discover from code go in; facts it can read from `package.json` don't. What the scaffolded repo must never contain: the skill's own version chatter, lineage or dev history — the project's wiki is about *this* project (templates ship neutral for exactly this reason). Fill `AGENTS.md` project facts and the **task-routing table in `context/index.md`** for this project's recurring task types.
4. **ADOPT only:** `setup` already drafted the map from the file census — now run the audit in `codebase-wiki.md` (verify the draft → modules via parallel read-only subagents or the `context-explorer` agent → cross-cutting → human confirmation → decisions archaeology). First `ctx tools`: where graphify/ctags/aider/dependency-cruiser exist, the structural pass is delegated to them and only distilled results enter the pages (`tool-delegation.md`). Pages stay `confidence: inferred` until verified; scope the next slice on top of reality — reuse, not regenerate.
5. **Name every tool in the stack and install its agent skill / fresh-docs MCP before speccing** (auth, ORM, payments, realtime…). Prefer agent-native tools (official skill/MCP). Record in `context/library-docs.md`.
6. **Monorepo or landmines?** Root AGENTS.md for what's true everywhere + nested `AGENTS.md` per package, and per risky directory (auth, payments, migrations — `setup --danger`); the warning loads at the moment of danger, not 4k tokens earlier. Per-package wiki above ~150 files (`context-routing.md → Scaling`).
7. **Wire enforcement:** hooks are in `.claude/settings.json`; optional `assets/pre-commit.template` → `.git/hooks/pre-commit`; CI step `node context/ctx.mjs lint`. Other tools: `ctx init --pointers`.
8. **Verify the scaffold like code:** `setup` ended with a green `ctx doctor` — then confirm `@AGENTS.md` resolves (`/memory`, `/context` on Claude Code); attempt to read `.env` and confirm the deny rule blocks; change a covered file and confirm `ctx impact`/Stop hook react; `ctx rules <file>` returns the path-gated conventions for a real file in the tree.
9. **First-session prompt** (give to the human):

> Read AGENTS.md. Read context/index.md and memory.md, skim progress-tracker.md. Run `node context/ctx.mjs brief` for the task, read only what it returns (TL;DR first). Confirm when you're ready to build Feature 01.

## Core loop (RUN)

1. **ORIENT** (≈2–5k tokens): `AGENTS.md` (incl. its Lessons) → `context/index.md` → `memory.md` → tracker skim → `ctx brief <files/keywords>` → TL;DRs; touching a file? `ctx rules <file>` for its path-gated conventions. Don't scan the repo.
2. **PLAN**: spec in `context/feature-specs/NN-*.md` (`ctx new feature <name>`); ledger entry `ctx task add "<unit>"`; clarify gate (≤5 questions, one at a time, answers written into the spec); value-source gate; plan saved; human reviews 5–10 min and rejects weak plans.
3. **BUILD** in scope: `ctx task start NN` (one unit at a time — the CLI enforces it); one boundary per unit (backend and UI are separate specs); UI first with mock data, logic second; logic ships its failing test first.
4. **RECORD while working** (table below).
5. **CONTEXT-DIFF**: `ctx impact` → fix every ✗ page and UNCOVERED file → `ctx stamp`.
6. **VERIFY**: lint/typecheck/build, drive the real flow, review against the spec checklist, converge.
7. **CLOSE**: `ctx index` → `ctx lint` → `ctx log build "<unit>"` → `memory.md`.

## The recording table (hard rules, enforced by hooks + lint)

| Event | Record |
|---|---|
| Starting a unit | `ctx task start NN` (ledger In progress; max one) |
| Finishing + verifying | `ctx task done NN -m "<concrete details: versions, config paths, env var names>"`; user-facing behavior documented in `docs/`. States stay exclusive; blocked → `ctx task block NN "why + what unblocks it"` |
| Hard technical decision | `decisions.md` D-NN (format below) — never buried in code/chat |
| Shortcut under pressure | `decisions.md` F-NN flagged assumption on that feature, visible until decided |
| Code changed | covering pages updated in the same change (`ctx impact`) |
| New area learned by reading code | page now (`ctx new module <name> --covers "<globs>"`) |
| Gap in a context page | fix the page during the build |
| New UI component | check `ui-registry.md` first; add after building if new |
| Bug | `current-issues.md`: symptom + suspect file + fix direction + definition of success |
| Human corrects you | one line in AGENTS.md **Lessons** ("When X, do Y", newest on top) — a correction not written down is a correction you'll receive again |
| New raw source | INGEST (source summary → affected pages → `ctx log ingest`) |
| Reusable answer | file as `type: query` page |
| Session end | `memory.md` (state, exact next step, working set, open questions, context debt) + `ctx log` |
| Feature/phase done | changelog + PR text from the **actual diff** |
| Periodic / before handoff | SYNC + cold-start eval (`references/evals.md`); `ctx archive` at phase boundaries to rotate log/tracker growth out of the hot files |

**Decision record** (`assets/decisions.md.template`): `## D-NN: <title> — <date>` · Trigger · Options considered · Chosen + why · Lost alternative + honest reason · Cost paid (moving part / latency / tolerated incorrectness / money) · Reversibility (easy | painful) · Correctness policy (what may be slightly wrong; what never).

## Page rules (summary — spec in `references/page-format.md`)

Every page under `context/` has frontmatter `title type status summary updated` (+ `tags`, `covers` for anything describing code, `confidence`), a `## TL;DR` first, ≤ ~160 lines, **why / contracts / invariants / gotchas — not what the code already says**, links by project-relative path + symbol, never line numbers, never machine-specific absolute paths, no secrets. Search the catalog before creating a page. Conflicts are flagged to the human, never silently overwritten. Delete → archive.

## Session protocol (summary — full: `references/session-protocol.md`)

- One fresh session per feature unit; degradation starts near ~50k tokens. Clear for anything new; compact only to continue — preserve current unit, modified files, commands, open questions, pages already read.
- Prompts are short: "Read spec NN. Mark it in progress. Implement exactly as specified, without going beyond scope." The files carry stack, folders, rules.
- Research the main thread doesn't need → parallel **read-only** subagents ("return behavior, files, constraints, recommended approach; do not implement"); the main agent writes the pages.
- Out-of-scope edits are reverted with a focused corrective prompt (file refs + screenshots, one issue at a time, what "done" looks like).
- Git at every phase boundary; per feature push → PR → review by a different model → human names which findings to fix; deferred findings written down.
- Completion = verify (real app) + test + review + document. Scale to risk.

## SYNC / LINT in one paragraph

Run at phase boundaries, before handoff, after merges, or when `ctx stale`/`ctx lint` complain: `ctx stale`, `ctx impact --since <ref>`, `ctx coverage`, `ctx lint` (after a merge it also catches tracker/spec/decision ID collisions — see `multi-user.md`); re-read flagged pages against code; code vs human-written statement → flag and let the human decide; preserve human edits; fix what is plainly outdated; `ctx stamp` verified pages; `ctx archive` when hot files grow; audit AGENTS.md vs CLAUDE.md vs rules vs skills for contradictions; delete legacy `.cursorrules/.windsurfrules/AGENT.md`; clear `current-issues.md` before merges; `ctx log sync`.

## Safety (never delegated)

- Humans manage `.env*`; secrets never enter chat or pages (names only; lint heuristics catch token-shaped strings).
- `.claude/settings.json`: deny > ask > allow. Deny `.env*` reads and edits to migrations and `context/raw/**`; ask before push/deletes/deploys/installs.
- Instruction files are advisory; **hooks are enforcement**: SessionStart re-injects orientation (also after compaction); Stop blocks ending when code changed but covering pages / tracker / memory weren't updated (loop-safe). Details: `references/safety-permissions.md`.
- `current-issues.md` is gitignored (pasted errors leak tokens) and cleared before merges.
- Tool auto-memory is scratch; files win in conflicts.
- Vet third-party skills/plugins/MCPs before installing (they run code). Before any tool that writes into AGENTS.md: back it up, merge back after.

## Architecture defaults (seed in workflow-rules.md)

Monolith first; relational DB by default; paginate every list; rate-limit every public endpoint; no secrets in code. Escalation ladder: bigger server → free checks (a missing index looks like a capacity problem) → reads (replicas, cache) before writes → queue before new infra → sharding last. One technology in many roles beats a new system per need. Load-balanced components keep zero per-user state in-process. Don't couple the user path to external services: answer fast, queue slow work; background jobs get retries + dead-letter + human review. Run the **value-source gate** before building. Correctness is a recorded policy per field (counts may lag 30s; balances never). Outsource the typing, never the decision-making. Detail: `references/architecture-decisions.md`.

## Interop

Tool-specific pointer files (`GEMINI.md`, Copilot, Cursor) only import AGENTS.md; SDLC packs route artifacts into `context/feature-specs/` with `decisions.md` as the single decision sink; one source of truth per fact — `docs/` is for humans, `context/` for agents, linked never duplicated; the scaffolded `.claude/agents/` explorer and reviewer carry exploration and fresh-eyes review out of the main window. Details: `references/multi-agent-interop.md`.

## References & assets

| File | Read when |
|---|---|
| `references/llm-wiki-pattern.md` | understanding/explaining the architecture; Karpathy mapping; failure modes |
| `references/page-format.md` | writing or reviewing any page (frontmatter spec, types, rules) |
| `references/operations.md` | executing ORIENT/QUERY/BUILD/INGEST/ADOPT/LINT/SYNC/HANDOFF/COMPACT |
| `references/codebase-wiki.md` | adopting an existing repo; writing map/module pages |
| `references/tool-delegation.md` | **before hand-building a code map/symbol/dependency view** — what to delegate to (graphify, ctags, aider, dependency-cruiser) and how to distill its output |
| `references/context-routing.md` | token budgets, `brief` ranking, scaling past ~150 pages |
| `references/ctx-cli.md` | any `ctx` command, lint rules, config, hook wiring |
| `references/evals.md` | proving the wiki works (cold-start test), regression guards |
| `references/multi-agent-interop.md` | other tools, monorepos, parallel agents |
| `references/multi-user.md` | teams: branch-per-unit ownership, merge-collision rules (lint-enforced), `ctx archive` rotation, keeping retrieval fast at scale |
| `references/context-files.md` | per-file content spec for every scaffolded file |
| `references/agents-md-rules.md` | authoring AGENTS.md/CLAUDE.md |
| `references/session-protocol.md` · `recording-workflows.md` | full working loop; entry templates; error protocol |
| `references/architecture-decisions.md` · `safety-permissions.md` · `claude-code-commands.md` | cost ritual; permissions/hooks/secrets; Claude Code mechanics |
| `scripts/ctx.mjs` | the CLI (copied to `context/ctx.mjs` by `init`) |
| `assets/*` | templates for every scaffolded file and page type |
