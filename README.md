# project-context-system

**[Live site: anshroshan.github.io/project-context-system](https://anshroshan.github.io/project-context-system/)**

**The model isn't your bottleneck. Your repo is.** Same model, same prompts — one dev gets a chatbot that re-explores the codebase every session, the other gets an agent that starts each session already knowing the project. The difference is a folder of compiled knowledge. This skill builds that folder, keeps it honest, and never lets it rot.

[![release](https://img.shields.io/github/v/release/AnshRoshan/project-context-system?color=blue)](https://github.com/AnshRoshan/project-context-system/releases)
[![ci](https://github.com/AnshRoshan/project-context-system/actions/workflows/ci.yml/badge.svg)](https://github.com/AnshRoshan/project-context-system/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](scripts/ctx.mjs)
![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![agents](https://img.shields.io/badge/Claude·Code-Codex·Cursor·Copilot·Gemini·Qoder-lightgrey)](references/multi-agent-interop.md)

Every session, your coding agent re-derives the same facts about the same repo — tokens spent rediscovering what it did last time. **Context is compiled, not retrieved**: this system has the agent *write down* what it learns, once, at change time, into an interlinked markdown wiki (`context/`); future sessions — any tool, any teammate's machine — orient from those files in ~2–5k tokens instead of re-exploring.

```
raw (code + context/raw/)  ──►  wiki (context/** pages)  ◄──  schema (AGENTS.md + context/index.md)
   immutable truth               agent-owned, human-reviewed      how to maintain it
```

Hooks and lint make it self-enforcing: code changed without updating the pages that describe it **blocks the session from ending**. Documentation is not a chore at the end of a PR — it is part of the diff, checked by tooling.

## 60-second start

```bash
# 1 — install the skill (auto-detects ~/.claude / ~/.qoder; --tool|--dest to steer)
git clone https://github.com/AnshRoshan/project-context-system
node project-context-system/scripts/ctx.mjs install

# 2 — set up any repo: greenfield or brownfield, any language (run from its root)
cd your-project && node <skill-dir>/scripts/ctx.mjs setup

# 3 — work. The agent orients, routes, records, and hands off through files.
node context/ctx.mjs brief src/auth/login.ts   # what to read for this task
node context/ctx.mjs task start 03             # one unit at a time, enforced
```

Or just paste to your agent: *"Clone `https://github.com/AnshRoshan/project-context-system`, install it, then set up this repository."* Setup is **idempotent and upgrade-safe** — re-run `setup` any time; filled content is never clobbered, and after updating the skill it upgrades the project in place.

## What lands in your repo

| Piece | What it does |
|---|---|
| `AGENTS.md` | the schema every agent reads first — ≤120 lines, routed, with a **Lessons** section that turns each of your corrections into a permanent one-liner |
| `context/` | the wiki: router index, append-only log, architecture/standards/decisions pages, **codebase map + module pages with `covers:` globs**, feature specs, immutable `raw/` for ingested docs |
| `context/progress-tracker.md` | the task ledger — In progress (max one) / Blocked / Up next / Completed, moved by `ctx task` |
| `.claude/rules/` | path-gated conventions: `frontend.md`-style rules load only when an agent touches matching files — zero tokens spent on what doesn't apply |
| `.claude/agents/` | explorer + reviewer subagents **with their own persistent memory** — agent experience becomes version-controlled |
| `docs/` | human-facing docs; agents read `context/` — one fact, one home, linked never duplicated |
| `context/ctx.mjs` | the zero-dependency CLI the project carries forever |

## Why it holds up

- **Any project, detected not assumed** — `ctx setup` reads manifests (Node, Python, Go, Rust, Java, Ruby, PHP, Dart, Elixir, C++…), classifies the shape (web-app / api / cli / library / mobile / data / monorepo), and scaffolds only what fits. A FastAPI repo gets no Next.js-flavored pages.
- **Delegates, doesn't hand-roll** — `ctx tools` finds graphify, ctags, aider, dependency-cruiser; the structural pass runs on real code-intelligence, the wiki keeps the distilled result.
- **Git-backed freshness** — `ctx stale`/`ctx impact` know exactly which pages the last commits invalidated; the Stop hook refuses to end until they agree.
- **Built for teams** — one unit = one branch = one owner; merge collisions (duplicate task/spec/decision IDs) surface as lint errors, not arguments. `ctx archive` rotates growth out of the hot files. See [references/multi-user.md](references/multi-user.md).
- **Prompts are products** — specs and subagent briefs follow ASD-STE100 (Simplified Technical English) discipline: one action per sentence, one word one meaning. [references/prompt-craft.md](references/prompt-craft.md).
- **Proven on itself** — this repo runs its own context system ([context/](context/)), lint 0 errors / 0 warnings; 47 end-to-end tests on ubuntu + macOS + **windows**; CI badge above is live.

## The CLI

```
setup · init · detect · tools         one-command scaffold, profile, delegation targets
brief · rules · coverage · status     route a task to pages; what applies to THIS file
task add|start|block|done|list        the ledger, one unit at a time
impact · stale · stamp · lint --fix   keep pages true to code (git-based)
index · log · new · archive           catalog, timeline, page scaffolds, growth rotation
doctor · install · hook               wiring checks (12), skill installer, Claude hooks
```

Read-only commands speak `--json` (`{command, ok}`) for scripts and CI. SessionStart/Stop hooks re-inject orientation (even after compaction) and block silent doc drift.

## The five laws

1. **Decide what to build first** — a line changed in a plan is free; a decision spread through the codebase is a rewrite.
2. **Make the hard calls on purpose** — every addition gets an explicit cost recorded.
3. **Keep the state in files** — updated *while* working, enforced by tooling, not goodwill.
4. **Never let the AI decide something important silently** — conflicts are flagged to the human.
5. **Read cheap, then deep** — index line → TL;DR → page → source. Stop at the first level that answers.

## Docs

[INSTALL.md](INSTALL.md) · [SKILL.md](SKILL.md) (the method agents follow) · [references/ctx-cli.md](references/ctx-cli.md) (every flag) · [references/operations.md](references/operations.md) (the nine playbooks) · [references/llm-wiki-pattern.md](references/llm-wiki-pattern.md) (the architecture) · [CHANGELOG.md](CHANGELOG.md)

**This repo vs your project:** dev history (CHANGELOG, tests, this README) stays here; `ctx install` ships only the skill; `ctx setup` writes only pages about *your* project — no version chatter, no lineage, test-guarded on both boundaries.

## Lineage & license

v1 distilled five senior-engineer AI-build courses plus audits against Anthropic docs, agents.md, OpenAI Codex guidance, GitHub Spec Kit and obra/superpowers. v2 rebuilt it on Andrej Karpathy's LLM-Wiki pattern (raw / wiki / schema; ingest / query / lint) with progressive-disclosure context engineering, git-backed staleness, and enforcement tooling.

MIT — see [LICENSE](LICENSE). Copy, adapt, reuse.
