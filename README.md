# project-context-system (v2.2 — LLM-wiki edition)

A drop-in skill that makes a software project **knowable from files**. Instead of an AI agent re-reading your codebase every session (slow, expensive, inconsistent), the project keeps a compiled, interlinked markdown wiki — Andrej Karpathy's *LLM Wiki* pattern applied to code — and a tiny CLI that routes every task to the few pages that matter, detects when pages go stale, and makes sure they get updated.

```
raw (code + context/raw/)  ──►  wiki (context/** pages)  ◄──  schema (AGENTS.md + context/index.md)
   immutable truth              agent-owned, human-reviewed      how to maintain it
```

Works with Claude Code, Codex, Cursor, Copilot, Gemini CLI, Qoder, Zed… (AGENTS.md is the single source of truth; everything else is a pointer).

## Install

**Just have it paste this repo's GitHub link to your agent:**

> Clone `https://github.com/AnshRoshan/project-context-system`, run `node <clone>/scripts/ctx.mjs install` to install it as a skill for my agent tool, then use it to set up this repository.

That's it — `install` auto-detects the tool homes (`~/.claude/skills`, `~/.qoder/skills`; `--tool claude|qoder` or `--dest <dir>` to steer) and ships only the skill itself (SKILL.md + references + assets + scripts).

Manual equivalents:

```bash
# from a clone
node <clone>/scripts/ctx.mjs install

# Claude Code plugin (keeps itself updated via the marketplace)
/plugin marketplace add AnshRoshan/project-context-system
/plugin install project-context-system

# plain copy, any tool that reads skills/*/SKILL.md
cp -r project-context-system ~/.claude/skills/    # or ~/.qoder/skills/, <project>/.claude/skills/
```

## This repo vs your project — the boundary

This repository is the skill's **development home**; nothing about its history belongs in a scaffolded project:

| Stays in this repo (dev) | Ships to a tool home (skill) | Lands in your project (scaffold) |
|---|---|---|
| CHANGELOG, README, INSTALL, tests/, .github, plugin metadata, graphify/dev notes | `SKILL.md`, `references/`, `assets/`, `scripts/ctx.mjs` | `AGENTS.md`, `context/`, `docs/`, `.claude/` — all written by `setup`, about *your* project only |

Enforced, not promised: the CLI copy installed into a project carries no lineage (test-guarded), `ctx install` excludes dev history (test-guarded), and scaffolded pages lint against absolute paths and placeholders. Release ritual: bump `VERSION` + metadata, run `node tests/run.mjs` (47 cases), tag.

## Use

1. Say **"set up the project context system"** (new project) or **"adopt this codebase into a context wiki"** (existing project).
2. One command does everything mechanical — greenfield or brownfield, idempotent, upgrade-safe. Run it **from your project root** (the only command that ever references anything outside it — after this, everything is relative):

   ```bash
   cd your-project && node <skill-dir>/scripts/ctx.mjs setup
   ```

   It detects the stack, scaffolds the whole system, generates path-gated rules and subagent memory, drafts the codebase map from the real file census, and finishes with a 12-point doctor self-check. Re-run it any time (also how you upgrade after updating the skill).
3. Answer the ~10-minute planning conversation. The agent fills the placeholders from your answers, never guesses.
4. Work per spec, one fresh session per unit. The agent orients from `context/index.md` + `memory.md` (≈ 2–5k tokens), loads only the pages `ctx brief` returns and the rules `ctx rules <file>` gates open, updates pages as it changes code, and hands off through `memory.md`.
5. Drop PRDs/notes/vendor docs into `context/raw/` and say "ingest this".

## What you get

```
AGENTS.md (with a Lessons section that learns from corrections)
CLAUDE.md(@AGENTS.md)  memory.md  docs/ (human docs)  .claude/settings.json (permissions + hooks)
.claude/rules/         path-gated conventions — load only when the matching files are touched
.claude/agents/        context-explorer + context-reviewer, each with persistent memory
context/
  index.md        router: task → pages, plus generated catalog (one line per page)
  log.md          append-only timeline  (## [date] op | title)
  overview, architecture, build-plan, code-standards, workflow-rules, library-docs,
  decisions, progress-tracker (the task ledger), current-issues (gitignored)
  + what your profile fits: ui-* (web/mobile), data-model, api-contracts, env-vars,
  integrations, runbook, glossary, testing
  codebase/map.md + codebase/modules/*.md      where things are, contracts, gotchas (`covers:` globs)
  agents/<name>/MEMORY.md                      subagent experience, version-controlled
  feature-specs/  raw/ (immutable)  sources/ (summaries)  designs/  screenshots/  archive/
  .ctx.json       config seeded from the detected stack    ctx.mjs   the CLI
```

## The CLI in 30 seconds

```bash
node <skill-dir>/scripts/ctx.mjs setup                   # THE one command, run from the project root: scaffold+rules+map draft+self-check
node context/ctx.mjs detect                          # what profile does this project have? (langs, kinds, groups)
node context/ctx.mjs tools                           # code-intel tools to delegate to (graphify, ctags, aider…)
node context/ctx.mjs brief src/auth/login.ts         # which pages to read (ranked, with token cost + TL;DRs)
node context/ctx.mjs rules src/auth/login.ts         # which path-gated rules apply to THIS file
node context/ctx.mjs task add "login flow"           # ledger: add / start / block / done — one unit at a time per branch
node context/ctx.mjs archive --dry-run               # rotate old log/tracker entries into context/archive/ (growth valve)
node context/ctx.mjs impact                          # code changed → ✗ pages that need updating
node context/ctx.mjs stale                           # pages behind the code (git-based)
node context/ctx.mjs lint                            # structure, links, orphans, tracker, decisions, secrets…
node context/ctx.mjs doctor                          # is the scaffold wired AND at the current skill version?
node context/ctx.mjs coverage                        # source files no page documents
node context/ctx.mjs new module billing --covers "src/billing/**"
node context/ctx.mjs index --llms                    # regenerate catalog (+ llms.txt)
node context/ctx.mjs status | log | stamp | hook
```

Read-only commands take `--json` (`{command, ok, …}`) for scripts and CI.

Hooks (Claude Code): **SessionStart** re-injects orientation (also after compaction); **Stop** blocks ending a session when code changed but the covering pages, tracker or memory weren't updated.

**Teams:** one unit = one branch = one owner; per-unit files keep parallel work conflict-free, `ctx lint` catches merge collisions (duplicate Feature/spec/decision IDs), `ctx archive` keeps the hot files small forever — the playbook is `references/multi-user.md`.

## Layout of this skill

| Path | Purpose |
|---|---|
| `SKILL.md` | router: modes, bootstrap, core loop, recording table, safety |
| `references/` | llm-wiki-pattern · page-format · operations · codebase-wiki · tool-delegation · multi-user · prompt-craft (ASD-STE100 for specs & briefs) · context-routing · ctx-cli · evals · multi-agent-interop · plus the v1 deep docs (context-files, session-protocol, recording-workflows, agents-md-rules, architecture-decisions, safety-permissions, claude-code-commands) |
| `scripts/ctx.mjs` | zero-dependency CLI |
| `assets/` | templates for every scaffolded file and page type |

## Lineage

v1 distilled five senior-engineer AI-build courses plus audits against Anthropic docs, agents.md, OpenAI Codex guidance, GitHub Spec Kit and obra/superpowers. v2 adds Karpathy's LLM-Wiki architecture (raw / wiki / schema, ingest / query / lint, index.md / log.md), progressive-disclosure context engineering, git-backed staleness detection, and enforcement tooling. See `CHANGELOG.md`.

MIT-style: copy, adapt, reuse.
