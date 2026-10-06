#!/usr/bin/env node
/**
 * ctx self-test — zero dependencies, no framework, no network.
 *
 *   node tests/run.mjs          run every case
 *   node tests/run.mjs brief    run cases whose name contains "brief"
 *
 * Each case gets a throwaway git repo and drives the CLI exactly the way an
 * agent or CI would, then asserts on the real output. The point is to catch the
 * bugs that only appear once the tool meets a repository: paths that get
 * mangled, hooks that loop, lints that silently pass, scaffolding that no-ops.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CTX_SRC = path.join(HERE, '..', 'scripts', 'ctx.mjs');

let passed = 0;
const failures = [];
const filter = process.argv[2] || '';

/* ----------------------------------------------------------------- helpers */
function sh(cmd, args, cwd, env = {}, input) {
  try {
    return { code: 0, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env }, input }) };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

/** A fresh git repo with a couple of source files. */
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-test-'));
  sh('git', ['init', '-q'], dir);
  sh('git', ['config', 'user.email', 't@example.com'], dir);
  sh('git', ['config', 'user.name', 'Test'], dir);
  fs.mkdirSync(path.join(dir, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'billing'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'session.ts'), 'export const login = () => "v1";\n');
  fs.writeFileSync(path.join(dir, 'src', 'billing', 'charge.ts'), 'export const charge = () => 1;\n');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo', scripts: { dev: 'next dev' } }, null, 2));
  return dir;
}

/** Run ctx in a repo. Returns { code, out }. */
function ctx(dir, ...args) {
  return sh('node', [path.join(dir, 'context', 'ctx.mjs'), ...args], dir);
}

/** Run a ctx hook the way Claude Code does: JSON payload on stdin. */
function ctxHook(dir, which, payload) {
  return sh('node', [path.join(dir, 'context', 'ctx.mjs'), 'hook', which], dir, {}, JSON.stringify(payload));
}

function test(name, fn) {
  if (filter && !name.includes(filter)) return;
  let dir;
  try {
    dir = sandbox();
    fn(dir);
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures.push({ name, message: e.message });
    console.log(` FAIL  ${name}\n       ${String(e.message).split('\n').join('\n       ')}`);
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    return;
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const assertContains = (haystack, needle, msg = '') =>
  assert(String(haystack).includes(needle), `${msg}\n--- expected to find ---\n${needle}\n--- in ---\n${String(haystack).slice(0, 2500)}`);

function initRepo(dir, extra = []) {
  const r = sh('node', [CTX_SRC, 'init', '--root', dir, ...extra], dir);
  assert(r.code === 0, `init failed: ${r.out}`);
  // Fill the one placeholder-free page we need and commit, mirroring a real setup.
  return r;
}

/* ------------------------------------------------------------------- cases */
console.log('\nctx self-test\n');

test('init scaffolds the documented tree and never overwrites', (dir) => {
  initRepo(dir);
  for (const f of ['AGENTS.md', 'CLAUDE.md', 'memory.md', 'context/index.md', 'context/log.md', 'context/decisions.md', 'context/ctx.mjs', '.claude/settings.json']) {
    assert(fs.existsSync(path.join(dir, f)), `${f} was not created`);
  }
  assert(fs.existsSync(path.join(dir, 'context', 'feature-specs')), 'feature-specs/ missing');
  assert(fs.existsSync(path.join(dir, 'context', 'codebase', 'modules')), 'codebase/modules/ missing');

  // Idempotence: a second init must not clobber human edits.
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'HAND EDITED\n');
  initRepo(dir);
  assert(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8') === 'HAND EDITED\n', 'init overwrote an existing file');
});

test('init refuses to no-op when the skill assets are absent', (dir) => {
  // The copy that init places in context/ has no assets/ beside it.
  initRepo(dir);
  const r = ctx(dir, 'init', '--root', path.join(dir, 'nested'));
  assert(r.code !== 0, 'init from the copied CLI should fail, not silently succeed');
  assertContains(r.out, 'assets', 'failure should explain what is missing');
});

test('dirty file paths are parsed intact (regression: porcelain trim)', (dir) => {
  initRepo(dir);
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'session.ts'), 'export const login = () => "v2";\n');
  const r = ctx(dir, 'impact', '--json');
  const data = JSON.parse(r.out);
  // Compare exactly: a substring check would be fooled by "src/..." containing
  // the truncated "rc/..." — which is precisely the bug being guarded against.
  assert(data.uncovered.includes('src/auth/session.ts'), `impact mangled the changed path: ${JSON.stringify(data.uncovered)}`);
  assert(!data.uncovered.some((f) => f === 'rc/auth/session.ts'), 'leading status column was eaten by trimming');
});

test('a file with spaces in its name is still routed', (dir) => {
  initRepo(dir);
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'my weird file.ts'), 'export const x = 1;\n');
  const data = JSON.parse(ctx(dir, 'impact', '--json').out);
  assert(data.uncovered.includes('src/auth/my weird file.ts'), `whitespace path was mangled: ${JSON.stringify(data.uncovered)}`);
});

test('impact flags a page whose covered code changed', (dir) => {
  initRepo(dir);
  ctx(dir, 'new', 'module', 'auth', '--covers', 'src/auth/**');
  ctx(dir, 'index');
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'setup'], dir);

  fs.writeFileSync(path.join(dir, 'src', 'auth', 'session.ts'), 'export const login = () => "v2";\n');
  const r = ctx(dir, 'impact');
  assertContains(r.out, 'REVIEW', 'impact should mark the auth page for review');
  assertContains(r.out, 'context/codebase/modules/auth.md');
});

test('stale detects covered code changed after the page was written', (dir) => {
  initRepo(dir);
  ctx(dir, 'new', 'module', 'auth', '--covers', 'src/auth/**');
  ctx(dir, 'index');
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'setup'], dir);

  fs.writeFileSync(path.join(dir, 'src', 'auth', 'session.ts'), 'export const login = () => "v2";\n');
  const r = ctx(dir, 'stale');
  assertContains(r.out, 'context/codebase/modules/auth.md', 'stale missed the changed module');
});

test('stamp clears staleness once the page is re-verified', (dir) => {
  initRepo(dir);
  ctx(dir, 'new', 'module', 'auth', '--covers', 'src/auth/**');
  ctx(dir, 'index');
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'setup'], dir);
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'session.ts'), 'export const login = () => "v2";\n');

  const before = ctx(dir, 'stale');
  assert(before.out.includes('modules/auth.md'), 'precondition: page should be stale');

  ctx(dir, 'stamp', 'context/codebase/modules/auth.md');
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'restamp'], dir);
  const after = ctx(dir, 'stale');
  assert(!after.out.includes('modules/auth.md'), `stamp should clear staleness, got:\n${after.out}`);
});

test('brief routes by covers and reports the token cost', (dir) => {
  initRepo(dir);
  ctx(dir, 'new', 'module', 'auth', '--covers', 'src/auth/**');
  const r = ctx(dir, 'brief', 'src/auth/session.ts');
  assertContains(r.out, 'modules/auth.md', 'brief did not match the covering page');
  assertContains(r.out, 'tokens');
});

test('brief warns when the file you are about to touch has no page', (dir) => {
  initRepo(dir);
  const r = ctx(dir, 'brief', 'src/billing/charge.ts');
  assertContains(r.out, 'BLIND SPOT', 'brief should surface the routing blind spot');
});

test('lint catches an incomplete decision record', (dir) => {
  initRepo(dir);
  const dec = path.join(dir, 'context', 'decisions.md');
  const text = fs.readFileSync(dec, 'utf8');
  fs.writeFileSync(dec, text.replace(/^## D-01[\s\S]*$/m, '## D-01: Choose Postgres — 2026-10-01\nTrigger: needed a database\nChosen: Postgres, because it is relational\n'));
  const r = ctx(dir, 'lint');
  assert(r.code !== 0, 'lint should fail on an incomplete decision record');
  assertContains(r.out, 'Lost alternative', 'lint should name the missing fields');
  assertContains(r.out, 'D-01');
});

test('lint accepts a complete decision record', (dir) => {
  initRepo(dir);
  const dec = path.join(dir, 'context', 'decisions.md');
  const text = fs.readFileSync(dec, 'utf8');
  fs.writeFileSync(dec, text.replace(/^## D-01[\s\S]*$/m,
    '## D-01: Choose Postgres — 2026-10-01\nTrigger: needed a relational store\nOptions considered: Postgres / SQLite / Mongo\nChosen: Postgres, because relations are the domain\nLost alternative: SQLite — it cannot serve concurrent writers\nCost paid: one more service to run and back up\nReversibility: painful — a schema rewrite plus a data migration\nCorrectness policy: writes are never stale; read replicas may lag seconds\n'));
  const r = ctx(dir, 'lint');
  assert(!r.out.includes('ERROR'), `a complete record should not error:\n${r.out}`);
});

test('lint catches a spec marked complete with unticked boxes', (dir) => {
  initRepo(dir);
  fs.writeFileSync(
    path.join(dir, 'context', 'feature-specs', '01-login.md'),
    '---\ntitle: Login\ntype: feature\nstatus: complete\nsummary: Login form\nupdated: 2026-10-01\n---\n\n# Login\n\n## Explicitly NOT in this spec\n- real SSO\n\n## Verification checklist\n- [x] build passes\n- [ ] the flow was driven in the browser\n',
  );
  const r = ctx(dir, 'lint');
  assert(r.code !== 0, 'lint should fail a spec that claims completion with open checks');
  assertContains(r.out, 'still unticked');
});

test('lint catches a feature in the tracker with no spec', (dir) => {
  initRepo(dir);
  const tr = path.join(dir, 'context', 'progress-tracker.md');
  fs.writeFileSync(tr, fs.readFileSync(tr, 'utf8').replace('- {{Feature NN: name — started {{date}}}}', '- Feature 07: phantom work'));
  const r = ctx(dir, 'lint');
  assertContains(r.out, 'Feature 07', 'lint should notice the missing spec');
});

test('lint enforces tracker state exclusivity', (dir) => {
  initRepo(dir);
  const tr = path.join(dir, 'context', 'progress-tracker.md');
  fs.writeFileSync(
    tr,
    fs.readFileSync(tr, 'utf8')
      .replace('- {{Feature NN: name — started {{date}}}}', '- Feature 03: the same work')
      .replace('- {{Feature NN: name — {{date}} — key decisions: D-NN; concrete details: versions, config paths, env var names}}', '- Feature 03: the same work — done'),
  );
  const r = ctx(dir, 'lint');
  assert(r.code !== 0, 'lint should fail when a feature is both in progress and complete');
  assertContains(r.out, 'exclusive');
});

test('lint catches a broken cross-link', (dir) => {
  initRepo(dir);
  const p = path.join(dir, 'context', 'overview.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8') + '\nSee [the missing page](./nope-does-not-exist.md).\n');
  const r = ctx(dir, 'lint');
  assert(r.code !== 0, 'lint should fail on a broken link');
  assertContains(r.out, 'broken link');
});

test('lint catches a secret-shaped string in a page', (dir) => {
  initRepo(dir);
  const p = path.join(dir, 'context', 'overview.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8') + '\nStripe key sk_live_51H8xQ2LkdIwHu7ixx for the demo.\n');
  const r = ctx(dir, 'lint');
  assert(r.code !== 0, 'lint should fail on a secret-shaped string');
  assertContains(r.out, 'secret');
});

test('lint --fix repairs the derived catalog without touching content', (dir) => {
  initRepo(dir);
  ctx(dir, 'index');
  const idx = path.join(dir, 'context', 'index.md');
  const before = fs.readFileSync(idx, 'utf8');
  fs.appendFileSync(idx, '\n## Stray hand-written section\n');
  ctx(dir, 'lint', '--fix');
  const after = fs.readFileSync(idx, 'utf8');
  assert(before === after || after.includes('Stray'), 'lint --fix should leave hand-written content outside the markers alone');
  assertContains(after, '<!-- ctx:index:start -->');
});

test('doctor verifies the scaffold is wired, not just present', (dir) => {
  initRepo(dir);
  const r = ctx(dir, 'doctor');
  assertContains(r.out, 'ctx doctor:');
  // A freshly-scaffolded repo must pass the import and gitignore checks.
  assert(!r.out.includes('FAIL  CLAUDE.md does not import'), 'CLAUDE.md import should be correct in the template');
});

test('doctor catches a CLAUDE.md that stopped importing AGENTS.md', (dir) => {
  initRepo(dir);
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# CLAUDE.md\nSome rules here.\n');
  const r = ctx(dir, 'doctor');
  assert(r.code !== 0, 'doctor should fail when the import is gone');
  assertContains(r.out, 'AGENTS.md');
});

test('doctor catches an un-gitignored issue file', (dir) => {
  initRepo(dir);
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n');
  const r = ctx(dir, 'doctor');
  assert(r.code !== 0, 'doctor should fail when current-issues.md is not ignored');
  assertContains(r.out, 'current-issues.md');
});

test('doctor catches a missing .env deny rule', (dir) => {
  initRepo(dir);
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: [], ask: [], deny: [] } }));
  const r = ctx(dir, 'doctor');
  assert(r.code !== 0, 'doctor should fail without a deny rule for secrets');
  assertContains(r.out, '.env');
});

test('doctor catches missing enforcement hooks', (dir) => {
  initRepo(dir);
  const sp = path.join(dir, '.claude', 'settings.json');
  fs.writeFileSync(sp, JSON.stringify({ permissions: { deny: ['Read(**/.env*)'] } }));
  const r = ctx(dir, 'doctor');
  assert(r.code !== 0, 'doctor should fail without hooks');
  assertContains(r.out, 'hook');
});

test('stop hook blocks when code changed without context updates', (dir) => {
  initRepo(dir);
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'setup'], dir);
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'session.ts'), 'export const login = () => "v2";\n');
  const r = ctx(dir, 'hook', 'stop');
  assert(r.code === 2, `stop hook should block (exit 2), got ${r.code}:\n${r.out}`);
  assertContains(r.out, 'memory.md');
});

test('stop hook never loops when re-invoked', (dir) => {
  initRepo(dir);
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'setup'], dir);
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'session.ts'), 'export const login = () => "v2";\n');
  const first = ctxHook(dir, 'stop', { stop_hook_active: false, cwd: dir });
  assert(first.code === 2, 'first pass should block');
  // Claude Code re-invokes the hook after a block; it must not block again.
  const again = ctxHook(dir, 'stop', { stop_hook_active: true, cwd: dir });
  assert(again.code === 0, `stop hook must not re-block when stop_hook_active is true, got ${again.code}:\n${again.out}`);
});

test('stop hook allows a stop when nothing changed', (dir) => {
  initRepo(dir);
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'setup'], dir);
  const r = ctx(dir, 'hook', 'stop');
  assert(r.code === 0, `clean tree should allow stop, got ${r.code}:\n${r.out}`);
});

test('session-start hook injects orientation and survives bad input', (dir) => {
  initRepo(dir);
  const r = ctx(dir, 'hook', 'session-start');
  assertContains(r.out, 'AGENTS.md');
  assertContains(r.out, 'memory.md');
  const bad = ctxHook(dir, 'stop', 'not-an-object');
  assert(bad.code === 0, `malformed hook input must degrade to a no-op, got ${bad.code}`);
});

test('session-start hook recognises a compaction', (dir) => {
  initRepo(dir);
  const r = ctxHook(dir, 'session-start', { source: 'compact', cwd: dir });
  assertContains(r.out, 'compacted', 'compaction should re-inject the reading order');
});

test('json output is machine readable and honours the documented ok contract', (dir) => {
  initRepo(dir);
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'setup'], dir);
  // Every command that accepts --json must emit parseable JSON *and* a boolean
  // `ok`, because that is the documented stability contract other tools rely on.
  for (const cmd of ['lint', 'status', 'stale', 'coverage', 'impact', 'doctor']) {
    const r = ctx(dir, cmd, '--json');
    let parsed;
    try {
      parsed = JSON.parse(r.out);
    } catch {
      throw new Error(`${cmd} --json did not emit valid JSON:\n${r.out.slice(0, 600)}`);
    }
    if (parsed.command !== cmd) throw new Error(`${cmd} --json is missing its \`command\` field, got ${JSON.stringify(parsed).slice(0, 200)}`);
    if (typeof parsed.ok !== 'boolean') throw new Error(`${cmd} --json is missing a boolean \`ok\` field, got ${JSON.stringify(parsed).slice(0, 200)}`);
  }
});

test('works without git and degrades gracefully', (dir) => {
  initRepo(dir);
  fs.rmSync(path.join(dir, '.git'), { recursive: true, force: true });
  for (const cmd of ['stale', 'lint', 'brief']) {
    const r = ctx(dir, cmd, 'src/auth/session.ts');
    assert(r.code === 0, `${cmd} should not crash without git (exit ${r.code}):\n${r.out}`);
  }
});

test('new pages use the shipped template when it is available', (dir) => {
  initRepo(dir);
  ctx(dir, 'new', 'module', 'billing', '--covers', 'src/billing/**');
  const p = path.join(dir, 'context', 'codebase', 'modules', 'billing.md');
  assert(fs.existsSync(p), 'module page was not created');
  const txt = fs.readFileSync(p, 'utf8');
  assert(/^title: Billing$/m.test(txt), `title not substituted:\n${txt.slice(0, 200)}`);
  assert(/^tags: \[billing\]$/m.test(txt), 'tags not substituted');
  assert(/^covers: \[src\/billing\/\*\*\]$/m.test(txt), 'covers not substituted');
  assert(!/\{\{TODAY\}\}/.test(txt), '{{TODAY}} should be substituted');
  assert(/^updated: \d{4}-\d{2}-\d{2}$/m.test(txt), 'updated should be a real date');
  // A new page must satisfy the structural lint rules immediately.
  const r = ctx(dir, 'lint');
  assert(!r.out.includes('missing frontmatter'), `new page failed lint:\n${r.out}`);
  assert(!r.out.includes('ERROR'), `new page has lint errors:\n${r.out}`);
});

test('new falls back to a built-in skeleton without the skill assets', (dir) => {
  initRepo(dir);
  // Remove the only template that `new module` would prefer, proving the CLI
  // still works from the copy in context/ (which ships no assets/).
  fs.rmSync(path.join(dir, 'context', 'codebase', 'modules', 'billing.md'), { force: true });
  ctx(dir, 'new', 'entity', 'invoice');
  const p = path.join(dir, 'context', 'invoice.md');
  assert(fs.existsSync(p), 'generic type page was not created');
  assert(fs.readFileSync(p, 'utf8').includes('title: Invoice'), 'fallback skeleton is malformed');
});

test('hook commands never hang when stdin has no payload', (dir) => {
  initRepo(dir);
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-qm', 'setup'], dir);
  // Regression: reading fd 0 synchronously blocks forever when the hook is run
  // by a human, CI or the pre-commit script instead of by Claude Code.
  for (const which of ['session-start', 'stop']) {
    const started = Date.now();
    const r = sh('node', [path.join(dir, 'context', 'ctx.mjs'), 'hook', which], dir, {}, '');
    const elapsed = Date.now() - started;
    assert(r.code !== null && r.code !== undefined, `${which} produced no exit status (likely killed)`);
    assert(elapsed < 8000, `${which} hung for ${elapsed}ms waiting on stdin`);
    assert(r.code === 0, `${which} on a clean tree should succeed, got ${r.code}`);
  }
});

test('unknown command prints usage instead of a stack trace', (dir) => {
  const r = sh('node', [CTX_SRC, 'not-a-command'], dir);
  assert(r.code !== 0, 'unknown command should exit non-zero');
  assert(!r.out.includes('at Object.'), 'should not dump a stack trace');
  assertContains(r.out, 'brief');
});

test('init adapts the scaffold to the detected project profile', (dir) => {
  fs.rmSync(path.join(dir, 'package.json'));
  fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname="x"\ndependencies=["fastapi","sqlalchemy"]\n');
  const r = sh('node', [CTX_SRC, 'init', '--root', dir], dir);
  assert(r.code === 0, `init failed: ${r.out}`);
  assert(!fs.existsSync(path.join(dir, 'context', 'ui-tokens.md')), 'UI pages created for a headless API');
  assert(fs.existsSync(path.join(dir, 'context', 'data-model.md')), 'data-model missing for a DB project');
  assert(fs.existsSync(path.join(dir, 'docs', 'README.md')), 'docs/ not scaffolded');
  assert(fs.existsSync(path.join(dir, '.claude', 'agents', 'context-explorer.md')), 'subagent definitions not scaffolded');
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'context', '.ctx.json'), 'utf8'));
  assert(cfg.sourceExt.includes('.py'), 'config not seeded from the python profile');
  assert(!cfg.sourceExt.includes('.tsx'), 'config carries extensions the project cannot have');
});

test('a frontend profile gets the UI pages', (dir) => {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'ui', dependencies: { react: '^19.0.0', next: '^15.0.0' } }));
  const r = sh('node', [CTX_SRC, 'init', '--root', dir], dir);
  assert(r.code === 0, `init failed: ${r.out}`);
  assert(fs.existsSync(path.join(dir, 'context', 'ui-tokens.md')), 'UI pages missing for a React project');
});

test('task ledger enforces the state machine', (dir) => {
  initRepo(dir);
  let r = ctx(dir, 'task', 'add', 'login flow');
  assert(r.code === 0 && /Feature 01/.test(r.out), `add failed: ${r.out}`);
  ctx(dir, 'task', 'add', 'billing');
  r = ctx(dir, 'task', 'start', '1');
  assert(r.code === 0, `start failed: ${r.out}`);
  r = ctx(dir, 'task', 'start', '2');
  assert(r.code !== 0 && /one unit/.test(r.out), 'a second unit must not start while one is active');
  r = ctx(dir, 'task', 'done', '1');
  assert(r.code !== 0, 'done without concrete details must fail');
  r = ctx(dir, 'task', 'done', '1', '-m', 'session.ts v2, env AUTH_URL');
  assert(r.code === 0, `done failed: ${r.out}`);
  const tr = fs.readFileSync(path.join(dir, 'context', 'progress-tracker.md'), 'utf8');
  assert(/## Completed[\s\S]*Feature 01: login flow — \d{4}-\d{2}-\d{2} — session\.ts v2/.test(tr), `done lost the title:\n${tr}`);
  assert(!/## In progress\n\n- Feature/.test(tr), 'the finished unit is still In progress');
  const j = JSON.parse(ctx(dir, 'task', 'list', '--json').out);
  assert(j.command === 'task' && typeof j.ok === 'boolean', 'task list --json contract');
});

test('detect and tools honour the json contract', (dir) => {
  initRepo(dir);
  const d = JSON.parse(ctx(dir, 'detect', '--json').out);
  assert(d.command === 'detect' && Array.isArray(d.langs) && Array.isArray(d.kinds), `detect json: ${JSON.stringify(d)}`);
  const t = JSON.parse(ctx(dir, 'tools', '--json').out);
  assert(t.command === 'tools' && Array.isArray(t.available), `tools json: ${JSON.stringify(t).slice(0, 200)}`);
});

/* ----------------------------------------------------------------- summary */
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f.name}`);
  process.exit(1);
}
