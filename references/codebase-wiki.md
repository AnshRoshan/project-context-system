# Codebase Wiki — making the repo knowable without reading it

Goal: an agent answering "where is X, how does Y work, what must I not break?" should hit **one map + one or two module pages**, not 40 source files. Source code says *what*. The wiki says **where, why, contracts, invariants, gotchas, who depends on whom**.

## The three code-facing artifacts

1. **`context/codebase/map.md`** — annotated tree (meaningful dirs only), entry points, "Where is X?" table, generated/do-not-edit paths. ≤ 120 lines. Template: `assets/codebase-map.md.template`.
2. **`context/codebase/modules/<area>.md`** — one page per cohesive area (≈ one top-level directory or domain concept). Frontmatter `covers:` declares exactly which files. Template: `assets/module.md.template`. Sections: TL;DR, responsibilities, public surface (symbol → file → contract), data flow, depends-on/used-by, invariants & gotchas, tests, open questions.
3. **Contract pages** (when they exist): `data-model.md` (meaning behind schema), `api-contracts.md`, `integrations.md`, `env-vars.md`, `glossary.md`, `testing.md`, `runbook.md`.

## What belongs, what doesn't

| Put in the wiki | Leave to the code |
|---|---|
| purpose, boundaries ("owns X, does NOT own Y") | function bodies, type definitions |
| contracts: inputs → outputs → errors, auth, idempotency | column lists (point to schema file) |
| invariants & the reason for them | obvious naming/structure |
| data flow across modules, side effects, queues, caches | per-line explanations |
| gotchas, past bugs, "never do this here" | anything `grep` answers in 5 seconds |
| decisions that shaped the code (D-NN) | commit history |
| env var **names**, external service behavior | secret values |

## Adopt procedure (existing project)

Run once; takes a session or three on a big repo. Read-only until step 6. **Before step 2, run `ctx tools`** — if graphify/ctags/aider/dependency-cruiser are available, delegate the structural pass to them and distill (`tool-delegation.md`); the subagent procedure below is the fallback, not the default.

1. **Manifest pass** — `package.json`/`pyproject`/`go.mod`, lockfile versions of key libraries, scripts, CI config, Dockerfile, `.env.example` (names only). `ctx detect` already read the profile — record it in `architecture.md` + `library-docs.md`. Check existing docs (README, ADRs) — ingest them as raw sources, don't trust them blindly.
2. **Structure pass** — tree to depth 3 (ignoring build output/vendored). Draft `codebase/map.md`: entry points, routing, generated paths. Tests layout.
3. **Boundary pass** — list candidate modules (dirs / domains). For each, decide `covers` globs. Ensure no large unowned areas (`ctx coverage`).
4. **Deep pass, parallelized** — one **read-only subagent per module**: *"Read these files. Return: purpose, public surface with contracts, data flow, dependencies, invariants, gotchas, test location, questions. Do not modify anything."* The main agent writes the pages from the returns (so one voice, one format). Mark `confidence: inferred`.
5. **Cross-cutting pass** — flows that span modules: request lifecycle, auth & ownership checks, error handling, background jobs, caching. These become `architecture.md` sections or `guide` pages; link them from the module pages.
6. **Human confirmation** — present the map and the 5–10 least certain claims. Corrections become `verified`; unanswered become `## Open questions`.
7. **Decisions archaeology** — for visible hard choices (why queue? why this auth lib?), write D-NN entries marked "reconstructed — confirm". Never invent a rationale: if unknown, say "rationale unknown".
8. **Close** — `ctx index` → `ctx lint` → `ctx coverage` (target ≥ 80% of source files) → `ctx stamp` verified pages → cold-start eval (`evals.md`) → `ctx log audit "adopted codebase"` → set `memory.md` next step.

## Keeping it alive (update-on-change)

- Every PR/unit ends with `ctx impact`. ✗ = covered code changed without its page → fix or confirm+stamp.
- New directory/feature without a page → `ctx impact` lists it as UNCOVERED.
- Renames/moves: update `covers`; `ctx lint` flags dead globs.
- A file touched by many modules is a smell worth a decision record.
- Big refactor → plan the wiki edits first (which pages change), do them in the same PR.

## Granularity heuristics

- <10 source files total → map + architecture only; no module pages.
- 10–150 files → map + module pages per top-level area.
- 150+ files / monorepo → per-package nested `AGENTS.md` + per-package `codebase/` sub-wiki with its own `index.md`; root index links to package indexes (see `context-routing.md → Scaling`).
- Prefer fewer, richer module pages over many thin ones: a page should be worth its token cost.
