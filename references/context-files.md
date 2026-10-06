# Context Files - per-file content spec

> v2: every file under `context/` (except raw/, designs/, screenshots/, archive/, index.md, log.md, current-issues.md) is a **page** with frontmatter and a `## TL;DR` — see `page-format.md`. New files are listed in the "v2 files" section at the bottom. The folder is entered through `context/index.md`, not read wholesale.

Everything in `context/` is what the coding agent reads before it does anything. This is how it stays consistent across every session, commit, and unit of the build. The files travel with the project for its entire life.

## overview.md
What the product is, who it's for, every page/screen and the full user flow, what's complex, and **explicitly what is in scope AND what is deliberately out of scope**. The out-of-scope list is "telling the agent: don't even think about them". No scope creep.

## architecture.md
Tech stack plus the *role* of each tool (so the agent doesn't invent a custom websocket implementation when Liveblocks is already in the stack). Folder structure, system boundaries, data flow, DB schemas. And the invariants: "rules that the system must never violate" - e.g. "API routes contain no UI logic. Components contain no DB logic. Agent code in /agents never imports from components or actions. Server actions never call agents."

## build-plan.md
Every feature defined, scoped, and sequenced: "N total features across M phases", numbered "Phase 1 Feature 01...". The agent never has to decide what comes next. Keep scope separate from tech: the plan says *what*; the stack is its own decision, so "your plan doesn't rot the day you change the tool". New ideas get appended as new phases/features during the build.

## code-standards.md
TypeScript rules, naming conventions, framework-version conventions, file/folder naming, component structure, error handling, server actions patterns.

## workflow-rules.md
How the agent behaves: one feature unit at a time, stay in your lane, what to do when something needs a decision (stop and ask), the error protocol, the recording obligations. This is the discipline layer - copy the template verbatim.

## library-docs.md
Project-specific usage per third-party library, with the rule: "before using any library, check if an MCP server or skill is configured for it, read that, and only then act." Updated whenever a library integration decision is made (versions, config paths, env var names).

## ui-tokens.md (UI projects)
Every color, spacing, radius, typography value as CSS variables. No hardcoded hex anywhere in code.

## ui-rules.md (UI projects)
Full design-system behavior: fonts, layout, cards, buttons, badges, states. Generate from Figma via MCP when available. Include anti-AI-ish bans (gradients, oversized hero sections) if they don't fit the product.

## ui-registry.md (UI projects)
Living component catalog, starts empty. Rule: "before building any UI, check if a similar component exists. If yes, match its exact classes. If no, build it following ui-rules and ui-tokens, then add it here."

## decisions.md
The decision log. One entry per hard technical decision, format in recording-workflows.md. "That's not buried in code. It's written down where you can see it and overrule it."

## progress-tracker.md
"The only file that actually updates constantly throughout the build." The task ledger: **In progress (max one — one unit at a time) · Blocked (with why + what unblocks it) · Up next · Completed** with concrete details (tool versions, "Prisma config uses prisma/ and not some other path", "database URL reads from .env") + session notes. Move lines with `ctx task add|start|block|done` — it enforces the state machine (start refuses a second active unit; done refuses a vague completion). Hand edits are fine; `ctx lint` checks the invariants. States stay mutually exclusive. Recovery promise: "if we come back 2 months later, it'll know it's using shadcn, Tailwind v4, dark theme only, and all the architectural decisions."

## current-issues.md
The bug queue. Gitignored - pasted errors have leaked JWTs into public repos. Numbered issues: symptom + suspected file + fix direction + definition of success. Cleared/archived before merges.

## feature-specs/
One file per unit of work, `NN-kebab-case.md`, zero-padded sequence = build order. ~20-30 specs for a full production app is normal. Each spec contains: goal (concrete, measurable), files it touches, exclusions ("do NOT add X, Y, or Z yet - that's the keyword right here"), and a verification checklist ("all components import without errors, no default light styling, build passes, no hardcoded colors"). Backend and UI are separate specs; big features split into 2-3 independent specs that together complete the experience.

## designs/ and screenshots/
`designs/`: a visual reference per page (landing-page.png, dashboard.png) - "when the agent builds UI, it's not inventing, it's matching what's already there." `screenshots/`: ongoing visual feedback for corrective prompts.

## Portability
Same folder works across Claude Code, Codex, Copilot, Cursor. Hand the folder to another developer and their agent continues from there. Start slow, keep adding as you go; reuse and slightly adapt the same files for future projects.

## v2 files

### index.md
Router + catalog. Hand-written top: orient steps, **task-routing table** (task type -> ordered pages), layer explanation. Generated bottom (between `<!-- ctx:index:* -->`): every active page as `[title](path) — summary`, grouped by type, flagged `(inferred)`/`(unfilled)`. Regenerate with `ctx index`; never hand-edit the generated block. Keep the whole file under ~6k tokens (see context-routing.md Scaling).

### log.md
Append-only timeline. Entry format `## [YYYY-MM-DD] op | title` + 1-2 lines (what changed, which pages). Ops: ingest, query, build, decision, fix, lint, sync, audit, handoff. Greppable: `grep "^## \[" context/log.md | tail -10`.

### codebase/map.md and codebase/modules/*.md
The code-facing wiki: annotated tree, entry points, "where is X?", and one page per module with `covers:` globs, public surface, data flow, invariants, gotchas. See `codebase-wiki.md`.

### data-model.md · api-contracts.md · integrations.md · glossary.md · env-vars.md · testing.md · runbook.md
Create when they pass the page-worthiness test (`ctx init --full` scaffolds all). Contracts and meaning, not copies of code: data-model explains entities/lifecycle/correctness policy and points to the schema file; api-contracts lists routes/actions/events with auth, inputs, outputs, errors; integrations records every external service's role, failure behavior and limits; glossary fixes vocabulary (one meaning per term); env-vars lists names and purpose, never values; testing holds commands, layout, must-cover areas and the cold-start question set; runbook has local setup, deploy, rollback, debugging playbook.

### raw/ and sources/
`raw/` = immutable inputs (PRDs, notes, vendor docs, exports); never edited (settings deny edits). `sources/<slug>.md` = one summary page per raw file (`type: source`, `raw:` pointer, key claims, pages updated, contradictions). See operations.md INGEST.

### queries/ (optional)
Reusable answers filed back from QUERY as `type: query` pages with `covers` for what they cite.

### archive/
Retired/superseded pages and old logs. Excluded from the catalog and lint, still greppable.

### docs/ (outside context/ — human-facing)
`docs/README.md` defines the split: humans read `docs/`, agents read `context/`; one fact, one home, links not copies. `docs/runbooks/` for operator steps, `docs/adr/` for decision records exported for humans. A feature is not documented until its user-facing behavior is written here.

### .claude/agents/ (outside context/ — subagents)
`context-explorer.md` (read-only code investigator that returns wiki gaps, never file dumps) and `context-reviewer.md` (fresh-eyes diff reviewer at unit boundaries; must-fix/should-fix/note). Each owns a persistent `context/agents/<name>/MEMORY.md` (excluded from the wiki page set): read first, append ≤3 dated one-liners per run, keep under ~60 lines — the agent starts smarter than it ended. The main agent still writes the pages.

### .claude/rules/ (outside context/ — path-gated)
Generated by `setup` from the profile (frontend/api/data/testing as applicable). Each file is a 6-line pointer: `paths:` globs + `read:` the wiki pages to load. The rule enters context only when the agent touches a matching file; the knowledge itself stays in `context/` (single source of truth). `ctx rules <file>` shows what applies to a file.

### AGENTS.md §Lessons
The self-improving section: every human correction becomes one line ("When X, do Y"), newest on top, ≤20, stale lines deleted. A correction not written down is a correction you will receive again.

### .ctx.json
Tool config, **generated by `init` from the detected project profile** (limits, source extensions, ignore globs per stack). Edit by hand to override; `ctx detect` shows what init saw.
