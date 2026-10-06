---
title: Decisions Log
type: decision-log
status: active
summary: Every hard technical decision with options, lost alternative, cost and reversibility; plus flagged assumptions
tags: [decisions,adr,tradeoffs]
updated: 2026-10-06
verified_at: 080a7adb7826
---

# Decisions Log

## TL;DR

- Four live decisions: D-01 zero-dep CLI, D-02 delegate code-intel but keep the wiki authoritative, D-03 everything project-relative, D-04 three-boundary no-leak model.
- Reversibility: D-01/D-03/D-04 are painful-to-easy policy anchors — changing one needs a new D entry that supersedes it, not an edit.

One entry per hard technical decision, written the moment it is made. Not buried in code, not lost in chat — written down where the human can see it and overrule it.

Defaults already assumed (no entry needed): monolith first, relational DB by default, paginate every list, rate-limit every public endpoint, no secrets in code.

## Decision record format

```markdown
## D-NN: <title> — <date>
Trigger: what forced this decision
Options considered: A / B / C
Chosen: <option>, because <reason>
Lost alternative: <option>, honest reason it lost
Cost paid: new moving part / per-request latency / tolerated incorrectness / money
Reversibility: easy | painful (what a rollback costs)
Correctness policy: what is now ALLOWED to be slightly wrong (and what never is)
```

---

## FLAGGED assumptions (undecided shortcuts, visible until decided)

```markdown
## F-NN: <assumption> — <date> (attached to Feature NN)
We built assuming <X>. Nobody has decided this. Needs a real call.
```

---

## D-01: Zero-dependency single-file CLI — 2026-10-06

Trigger: the CLI is copied into every user's repo and run on unknown machines; every dep is a future supply-chain, install and rot problem.
Options considered: single file, node builtins only / small npm package (commander, fast-glob, gray-matter) / hybrid (deps optional).
Chosen: single file, builtins only, because it must survive being copied into any repo on any OS with no install step — and the glob/frontmatter parsers it needs are ~80 lines.
Lost alternative: npm package — honest reason: `init` copies the tool into `context/` by design (the project must carry its own tooling), and a copied node_modules or a package that expects `node_modules` is exactly the fragility we're avoiding.
Cost paid: hand-rolled glob + frontmatter parsers (test-covered), no ecosystem niceties, ~800-line file instead of ~300.
Reversibility: painful — every user's context/ctx.mjs assumes self-containment.
Correctness policy: glob matching may miss exotic patterns (users can fix `covers:` by hand); file walking and git parsing must never be wrong.

## D-02: Delegate code intelligence, keep the wiki authoritative — 2026-10-06

Trigger: hand-building repo maps/module pages re-derives what graphify/ctags/aider/dependency-cruiser already index better.
Options considered: keep doing it by hand / require external tools / detect tools, distill their output, keep ctx as the bookkeeper.
Chosen: detect (`ctx tools`), delegate the structural pass where available, wiki stores only distilled results; manual subagent procedure remains the fallback.
Lost alternative: hard dependency on graphify — honest reason: it isn't everywhere, and the skill must degrade gracefully to zero-tool environments.
Cost paid: one more reference doc + probe code; output quality now depends on tools we don't own (mitigated by `confidence: inferred` + staleness policing).
Reversibility: easy — probes and doc only; no schema change.
Correctness policy: distilled tool output may be slightly wrong until verified (inferred); covers-globs and staleness checks must never lie.

## D-03: Everything project-relative — 2026-10-06

Trigger: absolute paths (`C:\Users\…`) in committed context break every other machine and make docs painful to port; user rule: "always use relative paths".
Options considered: allow absolute paths with lint silence / document the convention only / convention + CLI messages + lint check + test.
Chosen: all three layers — relative is the only shape the tool emits, warns on, and tests against.
Lost alternative: absolute-with-rewrite — honest reason: rewriting paths on read is a class of bugs worse than a rule nobody can violate.
Cost paid: one heuristic lint WARN that can't tell a quoted example from a real path (accepted: warnings are cheap).
Reversibility: painful — it's a user-facing contract now.
Correctness policy: the lint heuristic may miss exotic absolute forms; the CLI itself must never EMIT one.

## D-04: Three-boundary no-leak model (dev repo / installed skill / scaffolded project) — 2026-10-06

Trigger: skill dev history (version chatter, CHANGELOG, lineage notes) must not appear in users' repos or installs.
Options considered: one repo, careful copying / separate docs repo / single repo + explicit SHIP list + boundary tests.
Chosen: single repo, `ctx install` ships only SKILL.md+references+assets+scripts, project copies get a neutral CLI header — and a test guards each boundary so it can't rot.
Lost alternative: separate repos — honest reason: two places to keep in sync, worse for the one-link install flow.
Cost paid: the SHIP list must be remembered when adding shippable files; three extra tests.
Reversibility: easy.
Correctness policy: README/CHANGELOG may lag a release by hours; shipped files must never carry dev history at all.
