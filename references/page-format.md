# Page Format — the spec every wiki page follows

A page is a markdown file under `context/` (excluding `raw/ designs/ screenshots/ archive/`, `index.md`, `log.md`, `current-issues.md`). The format is a **spec, not a convention**: tooling (`ctx lint/index/brief/stale/impact`) depends on it, which is why the wiki stays machine-routable and doesn't decay into a per-project dialect.

## Frontmatter

```yaml
---
title: Auth module                    # required — human name, unique
type: module                          # required — see types below
status: active                        # required — draft | active | in-progress | complete | stale | superseded | archived
summary: Sessions, login, route guards — entry point src/auth/session.ts   # required, ≤160 chars: this IS the index line
updated: 2026-10-01                   # required — YYYY-MM-DD of last real edit
tags: [auth, security]                # strongly recommended — routing keywords (ctx brief)
covers: [src/auth/**, src/middleware.ts]   # REQUIRED for any page describing code — globs it is responsible for
related: [decisions.md, data-model.md]     # optional — hand-picked neighbours
confidence: verified                  # verified (checked against code/human) | inferred (read from code, plausible) | unverified (guess/hearsay)
verified_at: 3fa9c21d0b44             # optional — git sha when last re-verified with no edit needed (set by `ctx stamp`)
superseded_by: decisions.md#D-09      # required when status: superseded
---
```

Parser supports: scalars, inline lists `[a, b]`, block lists (`- x`). No nested maps — keep it flat.

## Types

| type | Use for | Typical `covers` |
|---|---|---|
| `overview` | product, scope, flows | — |
| `architecture` | stack, boundaries, invariants, codebase map | `src/**` |
| `module` | one cohesive area of code (the workhorse page) | its dir/files |
| `entity` | data model, domain objects | schema files |
| `api` | routes, actions, events, contracts | handlers dir |
| `integration` | external service | its wrapper dir |
| `feature` | a numbered spec (`feature-specs/NN-*.md`) | files it will touch |
| `plan` | build plan | — |
| `standards` | code/workflow rules | — |
| `guide` | how-to: env vars, testing, library docs | — |
| `runbook` | ops/debug procedures | — |
| `glossary` | domain vocabulary | — |
| `decision-log`, `tracker`, `ui` | the original context files | — |
| `source` | summary of a raw file | — (`raw:` field instead) |
| `query` | a filed answer to a question worth keeping | what it cites |

## Body

1. `# Title`
2. `## TL;DR` — **3–5 lines** an agent can stop reading at. The facts that change what it does next. (Required once a page passes ~40 lines.) This is level 1 of progressive disclosure: *index summary (level 0) → TL;DR (1) → full page (2) → source code (3).*
3. Sections that carry **why, contracts, invariants, gotchas, data flow, open questions** — not a re-statement of the code.

## Writing rules

- **Page-worthiness test.** Write a page only if it is (a) non-obvious from 60 seconds of reading the code, **or** (b) needed again and again, **or** (c) a decision/contract another area depends on. Otherwise let the code speak.
- **Pointers, not copies.** Reference `src/auth/session.ts → getSession()`; never paste function bodies or column lists that the code already holds. Never use line numbers (they move).
- **One topic per page, ≤ ~160 lines.** Over that → split. Search the catalog before creating (no duplicates).
- **Specific over vague.** "Two-space indentation" not "format code well".
- **Dated, not timeless.** Facts with a shelf life say when ("as of 2026-10, Drizzle 0.4x").
- **Cross-link** with relative markdown links (`[data model](../data-model.md)`) or `[[Page Title]]` wikilinks; both are lint-checked.
- **Secrets never.** Names of env vars only.
- **Contradictions are first-class.** If new information conflicts with a page, add a `> ⚠ Conflict:` callout with both claims + source and tell the human. Resolution → winner stays `active`; loser `status: superseded` + `superseded_by`. Never silently overwrite.
- **Unknowns are written down.** `## Open questions`, or `confidence: unverified`. An honest gap beats a confident guess.
- **Delete → archive.** Move retired pages to `context/archive/` (kept greppable, excluded from catalog).

## Status lifecycle

`draft` (created, TODOs remain) → `active` (verified, trusted) → `stale` (code moved; set automatically by *reporting*, not by hand) → back to `active` after re-verify + `ctx stamp` → `superseded` / `archived`.
Feature specs use `draft → in-progress → complete` and become history after completion; keep them (they record intent), mark `complete`.

## Naming

`kebab-case.md`. Specs `NN-name.md` (zero-padded = build order). Modules `codebase/modules/<area>.md`. One page ≈ one directory or one concept.
