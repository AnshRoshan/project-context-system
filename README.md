# project-context-system (v2.1 — LLM-wiki edition)

A drop-in skill that makes a software project **knowable from files**. Instead of an AI agent re-reading your codebase every session (slow, expensive, inconsistent), the project keeps a compiled, interlinked markdown wiki — Andrej Karpathy's *LLM Wiki* pattern applied to code — and a tiny CLI that routes every task to the few pages that matter, detects when pages go stale, and makes sure they get updated.

```
raw (code + context/raw/)  ──►  wiki (context/** pages)  ◄──  schema (AGENTS.md + context/index.md)
   immutable truth              agent-owned, human-reviewed      how to maintain it
```

Works with Claude Code, Codex, Cursor, Copilot, Gemini CLI, Qoder, Zed… (AGENTS.md is the single source of truth; everything else is a pointer).

## Install

```bash
# Claude Code (personal)         cp -r project-context-system ~/.claude/skills/
# Qoder CLI (personal)           cp -r project-context-system ~/.qoder/skills/
# Project-level (AgentSkills)    cp -r project-context-system <project>/.claude/skills/
```

## Use

1. Say **"set up the project context system"** (new project) or **"adopt this codebase into a context wiki"** (existing project).
2. Answer the ~10-minute planning conversation. The skill scaffolds everything from your answers, never guesses.
3. Work per spec, one fresh session per unit. The agent orients from `context/index.md` + `memory.md` (≈ 2–5k tokens), loads only the pages `ctx brief` returns, updates pages as it changes code, and hands off through `memory.md`.
4. Drop PRDs/notes/vendor docs into `context/raw/` and say "ingest this".

Manual scaffold: `node scripts/ctx.mjs init --root <project>` — the profile (languages, kinds, UI/DB/API, agent tools) is detected from the project, not assumed. Preview with `ctx detect`, override with `--ui/--no-ui`, `--full`, `--pointers`.

## What you get

```
AGENTS.md  CLAUDE.md(@AGENTS.md)  memory.md  docs/ (human docs)  .claude/settings.json (permissions + hooks)
.claude/agents/  context-explorer + context-reviewer (read-only subagents)
context/
  index.md        router: task → pages, plus generated catalog (one line per page)
  log.md          append-only timeline  (## [date] op | title)
  overview, architecture, build-plan, code-standards, workflow-rules, library-docs,
  decisions, progress-tracker (the task ledger), current-issues (gitignored)
  + what your profile fits: ui-* (web/mobile), data-model, api-contracts, env-vars,
  integrations, runbook, glossary, testing
  codebase/map.md + codebase/modules/*.md      where things are, contracts, gotchas (`covers:` globs)
  feature-specs/  raw/ (immutable)  sources/ (summaries)  designs/  screenshots/  archive/
  .ctx.json       config seeded from the detected stack    ctx.mjs   the CLI
```

## The CLI in 30 seconds

```bash
node context/ctx.mjs detect                      # what profile does this project have? (langs, kinds, groups)
node context/ctx.mjs tools                       # code-intel tools to delegate to (graphify, ctags, aider…)
node context/ctx.mjs brief src/auth/login.ts     # which pages to read (ranked, with token cost + TL;DRs)
node context/ctx.mjs task add "login flow"       # ledger: add / start / block / done — one unit at a time
node context/ctx.mjs impact                      # code changed → ✗ pages that need updating
node context/ctx.mjs stale                       # pages behind the code (git-based)
node context/ctx.mjs lint                        # structure, links, orphans, tracker, decisions, secrets…
node context/ctx.mjs doctor                      # is the scaffold actually wired (hooks, ignores, imports)?
node context/ctx.mjs coverage                    # source files no page documents
node context/ctx.mjs new module billing --covers "src/billing/**"
node context/ctx.mjs index --llms                # regenerate catalog (+ llms.txt)
node context/ctx.mjs status | log | stamp | hook
```

Read-only commands take `--json` (`{command, ok, …}`) for scripts and CI.

Hooks (Claude Code): **SessionStart** re-injects orientation (also after compaction); **Stop** blocks ending a session when code changed but the covering pages, tracker or memory weren't updated.

## Layout of this skill

| Path | Purpose |
|---|---|
| `SKILL.md` | router: modes, bootstrap, core loop, recording table, safety |
| `references/` | llm-wiki-pattern · page-format · operations · codebase-wiki · tool-delegation · context-routing · ctx-cli · evals · multi-agent-interop · plus the v1 deep docs (context-files, session-protocol, recording-workflows, agents-md-rules, architecture-decisions, safety-permissions, claude-code-commands) |
| `scripts/ctx.mjs` | zero-dependency CLI |
| `assets/` | templates for every scaffolded file and page type |

## Lineage

v1 distilled five senior-engineer AI-build courses plus audits against Anthropic docs, agents.md, OpenAI Codex guidance, GitHub Spec Kit and obra/superpowers. v2 adds Karpathy's LLM-Wiki architecture (raw / wiki / schema, ingest / query / lint, index.md / log.md), progressive-disclosure context engineering, git-backed staleness detection, and enforcement tooling. See `CHANGELOG.md`.

MIT-style: copy, adapt, reuse.
