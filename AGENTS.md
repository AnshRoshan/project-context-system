# AGENTS.md

Schema file for every coding agent in every tool (Claude Code reads CLAUDE.md, which imports this). This project keeps its knowledge in files: **read the wiki, don't re-explore the repo.**

## Orient — every session, in this order (≈ 2–5k tokens)

1. `context/index.md` — task routing + one-line catalog of every page
2. `memory.md` — current state, exact next step, open questions
3. `context/progress-tracker.md` — skim: what is in progress / done

Then route, don't browse: `node context/ctx.mjs brief <files or keywords of the task>` → read only the pages it returns, **`## TL;DR` first**. Open source files only for what the pages don't answer. If a page is marked stale (`node context/ctx.mjs stale`) or `confidence` ≠ verified, check the code before trusting it.

Before any code change also read `context/workflow-rules.md` and `context/code-standards.md`.

## Project facts

- Stack: Node ≥ 18 CLI (zero deps) + markdown skill (ctx detect: cli, library) · Toolchain: plain `node`, no build step
- Test: `node tests/run.mjs` · Check: `node --check scripts/ctx.mjs` + `node context/ctx.mjs lint` · Build: none (the CLI is copied, not built)
- No database, no backend — the "product" is the scaffolded wiki; do not invent runtime deps (D-01)
- Release ritual: bump `VERSION` in scripts/ctx.mjs + metadata (package.json, .claude-plugin/*), CHANGELOG entry, suite green, tag
- Design: docs are tight imperative agent instructions; no emoji, no marketing voice, SKILL.md stays ~130 lines

## Invariants (true every session)

- Work on one feature unit / system boundary at a time. Stay inside the spec's scope.
- Hard, ambiguous or invariant-changing decision → stop, write the options, ask the human. Never decide silently.
- Before touching a third-party library, read its entry in `context/library-docs.md` (skill/MCP/docs first).
- No hard-coded hex values; visual values come from `context/ui-tokens.md`.
- Secrets: never read `.env*`, never paste values anywhere. Env var **names** only.
- Paths and commands are **project-relative** (`node context/ctx.mjs …`, run from the repo root). Never write machine-specific absolute paths (`C:\Users\…`, `/home/…`) into committed files — they break for everyone else.
- Every value a feature shows or computes has a named source (value-source gate) — no source = ask.

## Maintain the wiki (you own it; the human reviews)

Record **while working**, not at the end:

| Event | Do |
|---|---|
| Start / finish a unit | `node context/ctx.mjs task start NN` / `task done NN -m "concrete versions, paths, env names"` (one unit In progress at a time; blocked → `task block NN "why"`) |
| Hard technical decision | `decisions.md` entry (D-NN, options, lost alternative, cost) |
| Bug found | `current-issues.md` (symptom, suspect file, fix direction, definition of success) |
| Code changed | update the page(s) that `covers` it — run `node context/ctx.mjs impact`; every ✗ gets fixed or confirmed unchanged, then `ctx stamp <page>` |
| New area learned by reading code | write/extend a page: `ctx new module <name> --covers "src/x/**"` — never leave knowledge only in chat |
| New source material (PRD, notes, vendor docs) | INGEST: `context/raw/` → `sources/` summary → update affected pages → `ctx log ingest` |
| Useful answer to a question | file it back as a page (type `query`) so it is never re-derived |
| End of session | `memory.md` (state, exact next step, open questions) + `ctx log` + `ctx index` + `ctx lint` |

Page rules: frontmatter required (`title type status summary updated`, plus `covers` for anything describing code); `## TL;DR` first; why/contracts/gotchas — not what the code already says; link files by path + symbol, never line numbers. Code and page disagree → flag it to the human; never silently overwrite either. Full rules: skill `references/page-format.md`.

## Skills & commands

- `node context/ctx.mjs` — `brief` `rules` `task` `impact` `stale` `lint` `doctor` `index` `coverage` `log` `stamp` `new` `status` `detect` `tools`
- `project-context-system` skill — SETUP / ADOPT / INGEST / QUERY / LINT / HANDOFF procedures
- **Delegate, don't hand-roll:** `ctx tools` lists code-intelligence tools here (graphify, ctags, aider, …). For a code map or dependency questions, run the tool first and distill its output into the wiki — never re-explore the repo by hand when a tool already indexed it
- **Humans read `docs/`, agents read `context/`** — one fact, one home; docs pages link into the wiki
- `graphify` skill — any structural question about THIS repo (it indexes codebases); prefer `ctx tools` probing over manual walking
- `skill-creator` — only when changing SKILL.md's structure or frontmatter description

## Verification

Run lint + typecheck + build + `node context/ctx.mjs lint` before declaring a unit done. Report results and what the human should review.

## Lessons (this file learns — newest on top)

Every human correction becomes a one-line lesson here: "When X, do Y." Add the moment it happens; delete lines that no longer apply; keep the whole section under ~20 lines (older lessons graduate into workflow-rules or a page).

- When parsing `git` output positionally, normalize CRLF and never `.trim()` the line — porcelain status lines START with a space (this bug shifted every path one char and "passed" until Windows).
- When matching library names against free manifest text, use word boundaries — 'gin' inside "context-engineering" claimed a Go backend.
- When passing flags to git via execFileSync, keep attached short options attached (`-uall`, never `-u all` — the second becomes a pathspec).
- Files copied INTO a user's project are user-facing: no version chatter, no lineage, no dev history (boundary tests enforce).
