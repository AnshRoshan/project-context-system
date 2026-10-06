---
title: Testing
type: guide
status: active
summary: The self-test harness — how to run it, what it covers, and the rule that makes it the contract
tags: [tests, quality]
covers: [tests/**]
updated: 2026-10-07
verified_at: d5ff854c4cf9
---

# Testing

## TL;DR

- Run all: `node tests/run.mjs` · filter: `node tests/run.mjs lint` · no deps, no network, ~30s.
- 47 cases. Each gets a throwaway git repo (`sandbox()`), drives the CLI the way an agent/CI would, asserts on real output.
- The suite IS the CLI contract (commands, exit codes, `--json` shapes, boundaries) — a feature without a test is unfinished.

## Layout & conventions

- One file, `test(name, fn)` + `assert/assertContains`; `initRepo`/`setupRepo` helpers mirror real usage; `ctx(dir, …)` runs the COPIED cli (proves portability); `ctxHook` pipes stdin payloads like Claude Code.
- Name cases as behavior ("stop hook never loops when re-invoked"), not as units ("test hook()").

## Must be covered

- Hook loop-safety and stdin no-hang; git path parsing (spaces, CRLF regressions); JSON contracts `{command, ok}`; scaffold idempotence + upgrade path; profile gating (python gets no UI pages); the two no-leak boundary tests; task-ledger state machine; lint rules both ways (fires + templates stay clean).

## Known flaky / slow

- `ctx tools` probes PATH (`where`/`which`) — tests only assert the array shape, never which tools exist on the machine.
- Sandbox creation is the slow part (~0.5s/case); acceptable, keep the suite under a minute.
