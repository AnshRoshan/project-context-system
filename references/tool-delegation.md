# Tool Delegation — don't hand-roll what a library does better

The context system **owns the knowledge**; it should not re-implement the machinery that
produces it. Run `node context/ctx.mjs tools` (and `ctx detect`) to see what's available in
this project before doing any of the following by hand. The rule: **the tool produces, the
wiki keeps** — run the tool, distill its output into `context/` pages (TL;DR, contracts,
gotchas), never paste raw dumps into pages.

## What to delegate to what

| Need | Prefer | Fallback (ctx does it) |
|---|---|---|
| Codebase map, module boundaries, "what depends on what" | **graphify** skill (`graphify-out/` present) — query the graph, write the distilled answer into `codebase/map.md` + module pages | parallel read-only subagents per area (`codebase-wiki.md`) |
| Repo map ranked by importance | **aider** `--map-tokens` | manual map from manifests + entry points |
| Symbol lists (functions/classes/exports per file) | **ctags** `ctags -R` / universal-ctags, or tree-sitter queries | subagent reads the files |
| Import graph, cycles, layering violations | **dependency-cruiser** (`--output-type dot/json`), **madge** (`--circular`, orphans) | grep imports per module |
| Fresh third-party docs before speccing | **context7 / official MCP servers / vendor agent-skills** — record the install + version in `library-docs.md` | WebFetch the docs, summarize |
| Coverage of changed files → pages | keep **`ctx impact`/`ctx stale`** — they are the wiki's own bookkeeping, git-based, no deps | — |
| Runtime behavior (what the app actually does) | browser MCP / Playwright — drive the flow, write findings into pages | manual verification notes |

## Protocol

1. **Detect once per project** — after `ctx init`, run `ctx tools`; write the winners into
   `AGENTS.md` "Skills & commands" (one line each: tool → when to use). Agents then route to
   them without re-discovering.
2. **Never trust raw output into a page.** A ctags listing is not knowledge; "auth module
   exports these 6 functions, 3 of them must never throw" is. Summarize, then stamp
   `confidence: inferred` unless you verified against code.
3. **Delegated facts still rot** — anything describing code gets a `covers:` glob, so
   `ctx stale`/`ctx impact` keep policing pages written from graphify output exactly like
   pages written by hand.
4. **No hidden dependencies.** ctx.mjs stays zero-dep; every tool above is optional. If
   none are installed, the manual procedures in `codebase-wiki.md` still work — they are
   the fallback, not a bug.
5. **Record the choice** — deciding "graphify is this project's map source" is itself a
   `decisions.md` entry (D-NN) with its cost (extra tool to keep installed).
