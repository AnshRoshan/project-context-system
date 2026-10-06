# Multi-agent & multi-tool interop

One wiki, every tool. The rule: **AGENTS.md is the single source of truth; every tool-specific file is a thin pointer.** Duplicated rules drift; pointers can't.

| Tool | Reads | What to scaffold |
|---|---|---|
| Codex, Cursor, Copilot (agent), Zed, Jules, Amp, many others | `AGENTS.md` | the real file |
| Claude Code | `CLAUDE.md` (and `AGENTS.md` only if no CLAUDE.md) | `CLAUDE.md` whose first line is `@AGENTS.md` (import loads at launch), plus `.claude/settings.json` (permissions + hooks), `CLAUDE.local.md` (gitignored) |
| Gemini CLI | `GEMINI.md` | `GEMINI.md` starting with `@AGENTS.md` |
| GitHub Copilot (chat/instructions) | `.github/copilot-instructions.md` | pointer file (template provided) |
| Cursor rules | `.cursor/rules/*.mdc` | `project-context.mdc` with `alwaysApply: true`, body = pointer |
| Windsurf, others | `AGENTS.md` (current) | delete legacy `.windsurfrules`, `.cursorrules`, singular `AGENT.md` |
| Web chat / no filesystem | whatever you paste | paste `AGENTS.md` + `context/index.md` + the TL;DRs from `ctx brief`; or point at `llms.txt` |

Scaffold pointers with `ctx init --pointers`.

## Loader budgets & gotchas
- Codex concatenates nested AGENTS.md root-down with a size cap (`project_doc_max_bytes`, ~32 KiB by default): keep each tiny; push content into `context/`.
- Claude Code loads CLAUDE.md fully at launch — big files cost tokens every session. Keep AGENTS.md ≤ 120 lines and let `index.md` route.
- First-match loaders can silently shadow AGENTS.md when a legacy file exists — `ctx lint` flags them.
- Hooks (`SessionStart`, `Stop`) are Claude Code features. For other tools the same checks run as: a pre-commit git hook (`assets/pre-commit.template`), CI (`ctx lint`), or by instruction ("run `ctx impact` before finishing").
- Tool "auto-memory" (learned notes in the tool) is scratch. The system of record is `memory.md` + `context/`. The SYNC pass resolves conflicts in favor of the files.

## Monorepos
Root `AGENTS.md` = what is true everywhere. Per-package nested `AGENTS.md` (`assets/nested-AGENTS.md.template`) = only local rules + a line pointing to that package's wiki. Per-package `context/` is optional but recommended above ~150 files; the root index lists each package index.

## Multiple agents at once (parallel work)
- Each agent owns **one spec / one boundary**; pages are the shared state, so conflicts show up in git, not in lost chat.
- Agents write to different pages by default; shared pages (`progress-tracker`, `decisions`, `index`) are append/merge-friendly by design — `ctx index` regenerates the catalog so merge conflicts there are resolved by re-running it.
- `log.md` is append-only → trivially mergeable.
- Researchers (read-only subagents) return findings; one writer commits to the wiki.

## Co-existing with other pipelines
SDLC packs (explore → plan → design → apply → verify → archive) overlap with the session protocol. Keep one source of truth: route their artifacts into `context/feature-specs/` (their status/approval become spec fields), make `decisions.md` the single sink for decisions, forbid a parallel spec tree. Standalone knowledge-base tools that write into AGENTS.md: back it up first and merge custom content back.

## Human tooling
The wiki is plain markdown + git: open it in Obsidian (graph view shows the link structure; wikilinks work), VS Code, or any editor. Obsidian is optional — nothing depends on it.
