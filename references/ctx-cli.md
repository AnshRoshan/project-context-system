# `ctx` CLI reference

Zero-dependency Node (≥ 18) script. Lives in the skill at `scripts/ctx.mjs`; `setup`/`init` copy it to `context/ctx.mjs` so the wiki is self-contained and portable. **After setup, always run from the project root with relative paths** — `node context/ctx.mjs <command>` (root is auto-detected; `--root <dir>` only for operating on another project). Git is used for staleness/impact; without git those features say so and skip.

```
node context/ctx.mjs <command> [args]
```

| Command | Purpose | Notes |
|---|---|---|
| `setup [--danger "dir1,dir2"] [init flags]` | **the one command**: init + path-gated `.claude/rules/` + `context/agents/*/MEMORY.md` + brownfield `codebase/map.md` draft (file census + manifest entry points) + `ctx index` + `ctx doctor` | idempotent — filled content is never clobbered; re-run after a skill update to upgrade in place (refreshes `context/ctx.mjs`, adds new files, bumps `setupVersion`; `doctor` flags stale projects). Run from the **project root** with the skill's script: `node <skill-dir>/scripts/ctx.mjs setup`. `--danger` drops a nested AGENTS.md in risky dirs |
| `init [--ui\|--no-ui] [--full] [--pointers] [--no-detect]` | detect the project profile, scaffold what fits, seed `context/.ctx.json`, copy the tool, merge `.gitignore` | never overwrites. Detection picks languages/kinds from manifests: UI/mobile signals → ui-* pages; db/backend → data-model/api-contracts/env-vars/integrations; deployable kinds → runbook; code → glossary/testing; detected agent tool dirs → their pointer files (`--pointers` = all). Always created: core pages, `docs/` (human docs), `.claude/agents/` (explorer + reviewer), `.claude/rules/`, `context/agents/*/MEMORY.md`. Overrides: `--ui/--no-ui`, `--full/--no-full`, `--pointers` (all tools), `--no-detect` (generic scaffold). Run from the project root: `node <skill-dir>/scripts/ctx.mjs init` |
| `rules <file...> [--json]` | what must be read for THESE files: path-gated `.claude/rules/*.md` (matched by `paths:` globs), covering wiki pages, nested AGENTS.md up the tree | zero tokens spent on rules that don't apply |
| `detect [--json]` | print the detected profile (langs, kinds, signals, tools, scaffold groups) | what `init` will do before it does it |
| `tools [--json]` | list installed code-intelligence tools to delegate to (graphify, ctags, aider, dependency-cruiser, madge, …) | run before hand-building any code map — see `tool-delegation.md` |
| `brief <file\|keywords…> [--limit N] [--budget TOK]` | rank the pages worth reading with TL;DRs and token cost | file args match `covers`; flags an uncovered file as a BLIND SPOT |
| `impact [--since REF] [--check] [--json]` | code changed → which pages to update (✗) / already updated (✓) / uncovered files | default = working tree; if clean = last commit. `--check` exits 2 when not clean |
| `stale [--strict] [--json]` | pages whose covered code changed after the page was last touched/stamped | baseline = last commit touching the page, or newer `verified_at` |
| `lint [--strict] [--fix] [--json]` | structure + hygiene + stale + decision-record completeness | errors → exit 1; `--fix` regenerates the index catalog; `--strict` makes warnings fail |
| `doctor [--json]` | verify the scaffold is wired: CLAUDE.md import, gitignore coverage, `.env` deny, both hooks, index markers, `setupVersion` vs skill version, rules + agent memory present | the install test; exits non-zero on any FAIL; a stale `setupVersion` FAIL means "re-run setup" |
| `index [--llms]` | regenerate catalog between `<!-- ctx:index:* -->` markers; `--llms` writes root `llms.txt` | |
| `coverage [--strict] [--json]` | % of source files covered by some page; blind spots by dir | `--strict` fails < 80% |
| `log <op> <title…> [-m note]` / `log --tail N` | append / read greppable timeline | entry: `## [YYYY-MM-DD] op \| title` |
| `task list\|add\|start\|block\|done` | the progress ledger in `progress-tracker.md` | `add "title" [--spec NN]` (an already-claimed number is refused — merge-safe); `start NN` enforces one unit at a time per branch (`--force` to override); `block NN "why"`; `done NN -m "concrete details"` (refuses vague done) |
| `archive [--dry-run] [--days N] [--keep-days N]` | the growth valve: rotates log entries older than `archiveAfterDays` (180) and tracker completions older than `trackerKeepDays` (90) into `context/archive/` (dated files, still greppable, pointer left behind) | run at phase boundaries; nothing is ever deleted; also prints the split plan when decisions.md outgrows its page budget |
| `stamp <page…> \| --touched` | set `updated` + `verified_at=HEAD` | use after re-verifying a page against code |
| `new <module\|feature\|source\|type> <name> [--covers "a,b"] [--title T]` | create a page with correct frontmatter | features auto-numbered |
| `status [--json]` | pages, stale count, coverage, orient cost, in-progress, recent log | the human dashboard |
| `hook session-start` / `hook stop` | Claude Code hook entry points | session-start re-orients and flags compaction; stop: exit 2 + message if code changed without page/tracker/memory updates; honors `stop_hook_active` (no loops) |

`--json` on any read-only command emits one object: `{ command, ok, … }` — `ok` is the stable "clean, keep going" boolean; `exitCode` is honored in JSON mode too.

## Config — `context/.ctx.json`
Generated by `init`/`setup` from the detected profile (`sourceExt` and `ignoreSourceGlobs` speak the project's language). Keys: `setupVersion`, `profile`, `maxPageLines`, `maxAgentsLines`, `maxSummaryChars`, `alwaysRead`, `archiveAfterDays`, `trackerKeepDays`, `sourceExt`, `ignoreSourceGlobs`, `ignoreDirs`, `pageExcludes`. Anything omitted keeps its default.

## Lint rules (what it checks)
Errors: missing frontmatter or required field · broken relative link or `[[wikilink]]` · missing `index.md`/`AGENTS.md` · duplicate decision IDs · feature in two tracker states · Feature id listed twice in one tracker section (branch-merge collision) · tracked unit with no spec (In progress/Completed) · decision record missing a required field (Trigger/Options/Chosen/Lost alternative/Cost/Reversibility/Correctness policy) · spec `complete` with unticked checks · secret-looking strings · (strict) unfilled `{{placeholders}}`.
Warnings: stale pages · orphans not in the index · dead `covers` globs · page > limit lines · no TL;DR on 40+ line pages · summary too long · superseded without `superseded_by` · unknown status · references to nonexistent D-NN · more than one unit In progress · tracked unit with no spec (Up next/Blocked) · two specs sharing a number (merge collision) · machine-specific absolute path in a page · AGENTS.md too long / not routed through the index · CLAUDE.md not importing AGENTS.md · legacy instruction files.

## Wire-up checklist
1. `settings.json` hooks → `SessionStart` + `Stop` (template included).
2. Optional `.git/hooks/pre-commit` from `assets/pre-commit.template`.
3. CI step: `node context/ctx.mjs lint` (add `--strict` later).
4. Verify like code: change a covered file and confirm the Stop hook blocks; run with `stop_hook_active: true` and confirm it doesn't loop.
