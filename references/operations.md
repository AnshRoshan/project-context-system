# Operations — the playbooks

Nine operations. Each has a trigger, steps, and a "done" test. Mechanics via `node context/ctx.mjs …` (see `ctx-cli.md`).

## 1. ORIENT (start of every session)
Trigger: new/cleared/compacted session. (A SessionStart hook injects a reminder; do it anyway.)
1. Read `AGENTS.md` → `context/index.md` → `memory.md` → skim `progress-tracker.md`. ≈ 2–5k tokens.
2. `ctx brief <task files/keywords>`; read TL;DRs of returned pages; open full pages only where TL;DR is insufficient.
3. If a returned page is stale / `inferred` / `unverified`: check the code it covers before relying on it.
Done when: you can state the current unit, the exact next step, the relevant invariants and files — **without having scanned the repo.**

## 2. QUERY (answer a question about the project)
1. `ctx brief <keywords>` → read TL;DRs → answer from pages, citing them.
2. Page missing/stale/low-confidence → read the code, answer, then **write or fix the page** (new knowledge must not stay in chat).
3. Answer is a reusable synthesis (comparison, "how does X flow end to end") → file it as `type: query` page via `ctx new query <slug>`, add `covers`, `ctx index`.
4. `ctx log query "<question>"` when a page was created/changed.

## 3. BUILD (implement a unit)
1. ORIENT. `ctx task add "<unit>"` if not already in the ledger → `ctx task start NN` (enforces one unit at a time).
2. Clarify gate (≤5 questions, one at a time) → answers written into the spec. Value-source gate. Save plan. Human approves.
3. Implement strictly in scope. Hard decision → `decisions.md` D-NN now. Bug → `current-issues.md` (`ctx task block NN "why"` if it stops you).
4. **Context-diff:** `ctx impact`. For each ✗ page: edit it to match the code, or confirm nothing it states changed; then `ctx stamp <page>`. For each UNCOVERED file: add it to a page's `covers` or `ctx new module`.
5. New knowledge from reading code → page now (`ctx new module <name> --covers "<globs>"`).
6. Verify (lint/typecheck/build, real flow). `ctx task done NN -m "concrete details"` — versions, paths, env names. Spec checklist ticked. User-facing behavior documented in `docs/`.
7. Close: `ctx index` → `ctx lint` → `ctx log build "<unit>"` → update `memory.md`.

## 4. INGEST (new raw source)
Trigger: PRD, meeting notes, vendor docs, customer feedback, design export, API spec dropped into `context/raw/`.
1. Read the raw file fully. Discuss key takeaways with the human if intent is ambiguous.
2. `ctx new source <slug>` → fill summary: TL;DR, key claims (with locations), open questions.
3. **Integrate:** update every affected page (a single source typically touches 3–15): overview/scope, glossary, data model, API contracts, specs, build plan, decisions. Add cross-links both ways.
4. **Contradictions:** where the source disagrees with existing pages, add `> ⚠ Conflict` callouts, record in the source page, and ask the human — do not pick a winner alone.
5. New decision implied → D-NN. New work implied → append to `build-plan.md` (never silently implement).
6. `ctx index` → `ctx lint` → `ctx log ingest "<source title>" -m "pages: a, b, c"`.
Done when: another agent could answer questions about the source from the wiki alone, and the raw file is untouched.

## 5. ADOPT / AUDIT (existing codebase, no wiki yet)
Full procedure in `codebase-wiki.md`. First run `ctx tools` — if a code-intelligence tool is available (graphify, ctags, aider, dependency-cruiser), delegate the structural pass to it (`tool-delegation.md`). Summary: manifest+tree → `codebase/map.md` → module pages via parallel read-only subagents → cross-cutting pages (data flow, auth, errors) → `confidence: inferred` until a human confirms → `ctx coverage` ≥ 80% → cold-start eval (`evals.md`).

## 6. LINT (health check)
Trigger: end of session, phase boundary, before handoff, pre-commit.
`ctx lint` (structure, links, frontmatter, orphans, placeholders, tracker exclusivity, decision IDs, AGENTS size, secrets heuristic, stale) + `ctx coverage`.
Then judgment checks the tool can't do: contradictory claims between pages, claims that are no longer true, important concepts mentioned but lacking a page, data gaps a source could fill, suggested new questions/sources. Fix, or list as context debt in `memory.md`.
`ctx log lint "<result>"`.

## 7. SYNC (docs vs reality, after a break or merge)
1. `ctx stale` + `ctx impact --since <last-synced-ref>` + `ctx coverage`.
2. Re-read each flagged page against code. Code disagrees with a human-written statement → flag, human decides. Pages disagree with each other → flag.
3. Fix what is plainly outdated; `ctx stamp` verified pages; update `confidence`.
4. Audit instruction files against each other (AGENTS.md vs CLAUDE.md vs .claude/rules vs skills); delete legacy `.cursorrules/.windsurfrules/AGENT.md`.
5. `ctx log sync "<ref range>"`.

## 8. HANDOFF (end of session / before another agent or human)
1. `ctx impact` clean (or listed as context debt). Tracker states exclusive and accurate.
2. `memory.md`: current state (concrete), **exact next step** (spec number, mode), working set (files, pages, commands), open questions (carried forward — never dropped), context debt.
3. `ctx index && ctx lint && ctx log handoff "<one line>"`.
4. Test: could a cold agent continue from these files alone? If you'd have to explain anything in chat, it belongs in a file.

## 9. COMPACT (the wiki is getting large)
Trigger: >120 pages, index > ~6k tokens, or `brief` returns noisy results.
- Merge near-duplicates; split >160-line pages; archive pages nobody routes to (`context/archive/`).
- Add sub-indexes per area (see `context-routing.md → Scaling`), keep top index to routing + areas.
- Complete feature specs older than the current phase → fold lessons into module pages/decisions, mark `complete`, archive if no longer routed.
- `log.md` over ~300 entries → archive the oldest year to `context/archive/log-YYYY.md`.
