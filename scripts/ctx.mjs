#!/usr/bin/env node
/**
 * ctx — the project's context-wiki tooling (installed by the project-context-system skill).
 *
 * The context/ folder is a compiled, interlinked markdown wiki about this project:
 * raw sources -> pages -> schema. This tool does the mechanical bookkeeping so
 * agents spend tokens on judgement, not on grep:
 *
 *   init        scaffold the whole system into a project (skips existing files);
 *               auto-detects the project profile (stack, kind, UI/DB/API, agent tools)
 *   setup       THE one command: init + path-gated rules + agent memory + mechanical
 *               codebase map draft (brownfield) + index + doctor. Idempotent — re-run
 *               any time (also upgrades: refreshes context/ctx.mjs and adds new files)
 *   install     install the skill itself into an agent tool's skills folder
 *               (--tool claude|qoder|auto, --dest dir); ships SKILL/references/assets/
 *               scripts only — repo dev history stays in the repo
 *   rules       which rules/pages apply to these files (path-gated, zero wasted tokens)
 *   detect      print the detected project profile (stack, kind, groups, pointer files)
 *   tools       code-intelligence tools available here to delegate to (graphify, ctags, …)
 *   brief       route a task/file/keywords to the few pages worth reading (+ token cost)
 *   impact      which pages must be updated for the code that changed
 *   stale       pages whose covered code changed after the page was last touched
 *   lint        health check: frontmatter, links, orphans, placeholders, tracker, budgets
 *   doctor      verify the scaffold is wired (imports, gitignore, permissions, hooks)
 *   index       regenerate the catalog in context/index.md (and llms.txt with --llms)
 *   coverage    source files that no page documents (blind spots)
 *   log         append a greppable entry to context/log.md
 *   task        task ledger: list|add|start|done|block (Now/Up next/Blocked/Completed)
 *   archive     rotate old log/tracker entries into context/archive/ (growth control)
 *   stamp       mark pages re-verified against current code
 *   new         create a page with correct frontmatter (module|feature|source|<any>)
 *   status      one-screen health summary
 *   hook        session-start | stop   (for .claude/settings.json hooks)
 *
 * Most read-only commands accept --json (stable contract: {command, ok, …});
 * lint also accepts --fix (regenerates the index catalog).
 *
 * Usage: node context/ctx.mjs <command> [args] [--root dir]
 * Node >= 18. No dependencies. Works without git (staleness features degrade gracefully).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(SELF), '..');
const VERSION = '2.4.0';

/* ------------------------------------------------------------------ args */
const VALUE_FLAGS = new Set(['root', 'since', 'budget', 'covers', 'title', 'm', 'tail', 'limit', 'type', 'summary', 'spec', 'danger', 'days', 'keep-days', 'tool', 'dest']);
const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = {};
const pos = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-m') flags.m = argv[++i];
  else if (a.startsWith('--')) {
    const k = a.slice(2);
    if (VALUE_FLAGS.has(k) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
    else flags[k] = true;
  } else pos.push(a);
}

/* ------------------------------------------------------------------ utils */
const posix = (p) => p.split(path.sep).join('/');
const today = () => new Date().toISOString().slice(0, 10);
const tokens = (s) => Math.ceil(s.length / 4);
const fmtTok = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/* --json contract: every payload has { command, ok }; `ok` means "clean, keep going". */
function emit(payload, humanFn) {
  if (flags.json) {
    console.log(JSON.stringify(payload));
    if (payload.exitCode) process.exit(payload.exitCode);
    return;
  }
  humanFn();
}

function findRoot() {
  if (flags.root) return path.resolve(String(flags.root));
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, 'context', 'index.md')) || fs.existsSync(path.join(dir, 'context', 'overview.md')) || fs.existsSync(path.join(dir, 'AGENTS.md')) || fs.existsSync(path.join(dir, '.git'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
}
const ROOT = cmd === 'init' ? path.resolve(String(flags.root || process.cwd())) : findRoot();
const CTX = path.join(ROOT, 'context');
const rel = (abs) => posix(path.relative(ROOT, abs));

const DEFAULTS = {
  maxPageLines: 160,
  maxAgentsLines: 120,
  maxSummaryChars: 160,
  oldPageDays: 120,
  archiveAfterDays: 180,
  trackerKeepDays: 90,
  alwaysRead: ['context/index.md', 'memory.md'],
  ignoreDirs: ['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.venv', 'venv', '__pycache__', 'target', 'vendor', '.cache', '.claude', '.cursor'],
  sourceExt: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.cs', '.swift', '.sql', '.prisma', '.vue', '.svelte'],
  ignoreSourceGlobs: ['**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/migrations/**', '**/drizzle/**', '**/*.config.*', '**/next-env.d.ts'],
  pageExcludes: ['context/raw/', 'context/designs/', 'context/screenshots/', 'context/archive/', 'context/agents/', 'context/index.md', 'context/log.md', 'context/current-issues.md', 'context/README.md'],
};
let CONFIG = { ...DEFAULTS };
try {
  CONFIG = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(path.join(CTX, '.ctx.json'), 'utf8')) };
} catch {}

function git(args, opts = {}) {
  try {
    // normalize line endings only — do NOT trim(): git status --porcelain lines
    // start with a status-column space and a global trim would shift every path by one
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024, ...opts }).replace(/\r\n/g, '\n').replace(/\s+$/, '');
  } catch {
    return null;
  }
}
const HAS_GIT = () => git(['rev-parse', '--is-inside-work-tree']) === 'true';

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (CONFIG.ignoreDirs.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ glob */
function globToRegex(glob) {
  let g = glob.replace(/^\.\//, '');
  if (g.endsWith('/')) g += '**';
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        if (g[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = g.indexOf('}', i);
      if (end > i) {
        re += '(?:' + g.slice(i + 1, end).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')';
        i = end;
      } else re += '\\{';
    } else re += c.replace(/[.+^$()|[\]\\}]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
const matchers = (globs) =>
  asList(globs)
    .filter((g) => !/\{\{/.test(String(g)) && String(g).trim())
    .map((g) => globToRegex(String(g)));
const anyMatch = (rxs, f) => rxs.some((r) => r.test(f));

/* ------------------------------------------------------------ frontmatter */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text, has: false };
  const data = {};
  const lines = m[1].split(/\r?\n/);
  let curKey = null;
  for (const line of lines) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && curKey) {
      if (!Array.isArray(data[curKey])) data[curKey] = [];
      data[curKey].push(unquote(li[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    curKey = kv[1];
    const v = kv[2].trim();
    if (v === '') data[curKey] = '';
    else if (v.startsWith('[') && v.endsWith(']')) data[curKey] = v.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    else data[curKey] = unquote(v);
  }
  return { data, body: text.slice(m[0].length), has: true };
}
function unquote(s) {
  return s.replace(/^["'](.*)["']$/, '$1');
}
function upsertFm(text, key, value) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return text;
  const block = m[1];
  const rx = new RegExp('^' + key + ':.*$', 'm');
  const nb = rx.test(block) ? block.replace(rx, `${key}: ${value}`) : block + `\n${key}: ${value}`;
  return text.replace(block, nb);
}

/* ------------------------------------------------------------------ pages */
function isPageFile(abs) {
  const r = rel(abs);
  if (!r.startsWith('context/') || !r.endsWith('.md')) return false;
  return !CONFIG.pageExcludes.some((x) => (x.endsWith('/') ? r.startsWith(x) : r === x));
}
let _pages;
function pages() {
  if (_pages) return _pages;
  _pages = walk(CTX)
    .filter(isPageFile)
    .map((abs) => {
      const text = fs.readFileSync(abs, 'utf8');
      const { data, body, has } = parseFrontmatter(text);
      return { abs, rel: rel(abs), relCtx: posix(path.relative(CTX, abs)), text, data, body, has, lines: text.split('\n').length };
    })
    .sort((a, b) => a.rel.localeCompare(b.rel));
  return _pages;
}
function tldr(p, n = 3) {
  const m = p.body.match(/##\s*TL;DR\s*\n([\s\S]*?)(?:\n##\s|$)/i);
  if (!m) return [];
  return m[1].split('\n').map((l) => l.trim()).filter(Boolean).slice(0, n);
}
function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

/* --------------------------------------------------------------- profiles */
/* The skill must fit every repo, so init never assumes Node or a web app:
   detect() reads the manifests that exist and derives languages, shape and
   which scaffold groups / config seeds make sense. */
const LANG_EXT = {
  node: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'],
  python: ['.py', '.pyi'],
  go: ['.go'],
  rust: ['.rs'],
  java: ['.java', '.kt'],
  ruby: ['.rb'],
  php: ['.php'],
  dart: ['.dart'],
  elixir: ['.ex', '.exs'],
  cpp: ['.c', '.cc', '.cpp', '.h', '.hpp'],
  docs: ['.md', '.mdx'],
};
const COMMON_EXT = ['.sql', '.prisma', '.proto', '.graphql', '.tf', '.sh', '.html', '.css', '.scss'];
const STACK_IGNORES = {
  node: ['**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/*.config.*'],
  python: ['**/__pycache__/**', '**/*.pyc', '**/.venv/**', '**/tests/**'],
  go: ['**/vendor/**', '**/*_test.go'],
  rust: ['**/target/**', '**/tests/**'],
  java: ['**/build/**', '**/src/test/**'],
};
const DEP_MARKERS = {
  ui: ['react', 'react-dom', 'next', 'vue', 'nuxt', 'svelte', '@angular/core', 'preact', 'solid-js', '@remix-run'],
  mobile: ['react-native', 'expo', '@ionic', 'flutter', 'native'],
  backend: ['express', 'fastify', 'koa', '@nestjs', 'hono', '@hapi', 'flask', 'django', 'fastapi', 'gin', 'actix', 'axum', 'rails', 'spring'],
  db: ['prisma', 'drizzle', 'typeorm', 'sequelize', 'knex', 'mongoose', 'postgres', 'mysql2', 'sqlalchemy', 'django', 'ecto', 'activerecord', 'gorm', 'diesel', 'sqlx'],
  cli: ['commander', 'yargs', 'minimist', 'oclif', 'inquirer', 'prompts', 'cobra', 'clap', 'argparse', 'typer', 'click', 'blessed'],
  data: ['pandas', 'numpy', 'scikit', 'airflow', 'pyspark', 'dbt', 'polars', 'spark'],
  docs: ['docusaurus', 'astro', 'vitepress', 'eleventy', 'mkdocs', 'sphinx'],
};
const MANIFEST_LANG = {
  'package.json': 'node', 'pyproject.toml': 'python', 'requirements.txt': 'python', 'setup.py': 'python', 'Pipfile': 'python',
  'go.mod': 'go', 'Cargo.toml': 'rust', 'pom.xml': 'java', 'build.gradle': 'java', 'build.gradle.kts': 'java',
  'Gemfile': 'ruby', 'composer.json': 'php', 'pubspec.yaml': 'dart', 'mix.exs': 'elixir', 'CMakeLists.txt': 'cpp', 'mkdocs.yml': 'docs',
};
const AGENT_TOOLS = [
  { id: 'claude', dir: '.claude', note: 'settings.json hooks + CLAUDE.md already wired by core' },
  { id: 'cursor', dir: '.cursor', file: 'cursor-rule.mdc.template', dest: '.cursor/rules/project-context.mdc' },
  { id: 'codex', dir: '.codex', note: 'reads AGENTS.md natively — no extra file needed' },
  { id: 'gemini', dir: '.gemini', file: 'GEMINI.md.template', dest: 'GEMINI.md' },
  { id: 'copilot', dir: '.github', file: 'copilot-instructions.md.template', dest: '.github/copilot-instructions.md' },
];

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function detect(root) {
  const langs = new Set();
  const signals = new Set();
  const manifests = [];
  const top = (() => {
    try {
      return fs.readdirSync(root);
    } catch {
      return [];
    }
  })();
  for (const f of top) {
    if (MANIFEST_LANG[f]) {
      langs.add(MANIFEST_LANG[f]);
      manifests.push(f);
    }
  }
  const pkg = readJsonSafe(path.join(root, 'package.json'));
  const allDeps = pkg ? Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }).join(' ').toLowerCase() : '';
  const manifestText = manifests.map((f) => (fs.readFileSync(path.join(root, f), 'utf8') || '').toLowerCase()).join(' ');
  // dep names may substring-match (npm scopes); free manifest text needs word-ish boundaries
  // so 'gin' inside "context-engineering" never claims a Go backend
  const depRx = (m) => new RegExp(`(^|[^a-z0-9-])${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'm');
  for (const [sig, markers] of Object.entries(DEP_MARKERS)) {
    if (markers.some((m) => allDeps.includes(m) || depRx(m).test(manifestText))) signals.add(sig);
  }
  if (pkg && (pkg.bin || /commander|yargs|oclif|inquirer/.test(allDeps)) && !signals.has('ui')) signals.add('cli');
  if (pkg && (pkg.main || pkg.exports) && !signals.has('ui') && !signals.has('backend')) signals.add('library');
  const isMonorepo = !!(pkg && pkg.workspaces) || top.includes('pnpm-workspace.yaml') || ['apps', 'packages'].some((d) => top.includes(d) && fs.existsSync(path.join(root, d)));
  const kinds = [];
  if (isMonorepo) kinds.push('monorepo');
  if (signals.has('mobile')) kinds.push('mobile');
  if (signals.has('ui')) kinds.push('web-app');
  if (signals.has('backend') && !signals.has('ui')) kinds.push('api');
  if (signals.has('cli')) kinds.push('cli');
  if (signals.has('data')) kinds.push('data');
  if (signals.has('library')) kinds.push('library');
  if (signals.has('docs')) kinds.push('docs');
  if (!langs.size && !kinds.length) {
    // probe with the DEFAULT code extensions — the seeded config may list .md, and the
    // scaffold's own pages must never flip a docs project into "generic" after setup
    const hasAnySource = walk(root).some((f) => DEFAULTS.sourceExt.includes(path.extname(f)) && !rel(f).startsWith('context/'));
    kinds.push(hasAnySource ? 'generic' : 'docs');
    if (!langs.size) langs.add(hasAnySource ? 'generic' : 'docs');
  }
  const sourceExt = [...new Set([...[...langs].flatMap((l) => LANG_EXT[l] || []), ...(langs.has('docs') && !langs.size ? [] : COMMON_EXT)])];
  const ignoreSourceGlobs = [...new Set([...(langs.has('node') ? STACK_IGNORES.node : []), ...[...langs].filter((l) => STACK_IGNORES[l] && l !== 'node').flatMap((l) => STACK_IGNORES[l])])];
  const tools = AGENT_TOOLS.filter((t) => top.includes(t.dir) || (t.id === 'copilot' && fs.existsSync(path.join(root, '.github', 'copilot-instructions.md'))));
  return { langs: [...langs], kinds, signals: [...signals], isMonorepo, manifests, tools: tools.map((t) => t.id), sourceExt, ignoreSourceGlobs };
}

/* Code-intelligence tools worth delegating to instead of hand-rolling (see references/tool-delegation.md). */
const INTEL_TOOLS = [
  { id: 'graphify', probe: () => fs.existsSync(path.join(ROOT, 'graphify-out')) || hasBin('graphify'), best: 'codebase map, module boundaries, dependency questions', how: 'run the graphify skill; distill its output into context/codebase/ pages (ctx owns covers:/TL;DR routing)' },
  { id: 'ctags', probe: () => hasBin('ctags') || hasBin('universal-ctags') || fs.existsSync(path.join(ROOT, 'tags')), best: 'symbol index (functions, classes, exports) per file', how: '`ctags -R` gives the public-surface tables of module pages for free' },
  { id: 'aider', probe: () => hasBin('aider'), best: 'repo-map ranked by PageRank over imports', how: '`aider --map-tokens 2048` output seeds codebase/map.md' },
  { id: 'dependency-cruiser', probe: () => hasBin('depcruise') || fs.existsSync(path.join(ROOT, 'node_modules', '.bin', 'depcruise')), best: 'import graph, cycles, layering violations', how: 'depcruise --output-type dot src | feed the edges into architecture.md dependency notes' },
  { id: 'madge', probe: () => hasBin('madge') || fs.existsSync(path.join(ROOT, 'node_modules', '.bin', 'madge')), best: 'circular dependencies, orphan modules', how: 'madge --circular src — record findings as gotchas in module pages' },
  { id: 'tree-sitter', probe: () => hasBin('tree-sitter'), best: 'structural queries in 100+ languages', how: 'use for symbol extraction when ctags is not enough' },
  { id: 'pyright/mypy', probe: () => hasBin('pyright') || hasBin('mypy'), best: 'python type surface', how: 'typecheck command for AGENTS.md project facts' },
  { id: 'go list', probe: () => detect(ROOT).langs.includes('go') && hasBin('go'), best: 'package dependency graph', how: '`go list -deps ./...` feeds module pages' },
  { id: 'cargo', probe: () => detect(ROOT).langs.includes('rust') && hasBin('cargo'), best: 'crate graph', how: '`cargo tree` seeds library-docs.md' },
];
function hasBin(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------- git state */
function dirtyFiles() {
  const out = git(['status', '--porcelain', '-uall']);
  if (!out) return new Set();
  const s = new Set();
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    let f = line.slice(3);
    if (f.includes(' -> ')) f = f.split(' -> ')[1];
    f = f.replace(/\s+$/, '');
    if (f.startsWith('"') && f.endsWith('"')) f = f.slice(1, -1);
    s.add(f);
  }
  return s;
}
const diffCache = new Map();
function committedDiff(base) {
  if (!diffCache.has(base)) {
    const o = git(['diff', '--name-only', base, 'HEAD']);
    diffCache.set(base, o === null ? null : o.split('\n').filter(Boolean));
  }
  return diffCache.get(base);
}
const validCommit = (s) => !!s && git(['cat-file', '-e', `${s}^{commit}`]) !== null;
const isAncestor = (a, b) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/** Staleness = covered code changed after the page was last touched (or re-stamped). */
function staleReport() {
  if (!HAS_GIT()) return { available: false, items: [] };
  const dirty = dirtyFiles();
  const items = [];
  for (const p of pages()) {
    const covers = asList(p.data.covers);
    if (!covers.length || ['superseded', 'archived'].includes(p.data.status)) continue;
    const rx = matchers(covers);
    const last = git(['log', '-1', '--format=%H', '--', p.rel]);
    const v = p.data.verified_at;
    let base = last || null;
    if (v && validCommit(v)) {
      const full = git(['rev-parse', v]);
      if (!last || isAncestor(last, full)) base = full;
    }
    const pageDirty = dirty.has(p.rel);
    if (!base && !pageDirty) continue;
    let files = [];
    if (base) {
      const d = committedDiff(base);
      if (d) files = d.filter((f) => !f.startsWith('context/'));
    }
    if (!pageDirty) files = files.concat([...dirty].filter((f) => !f.startsWith('context/')));
    const hits = [...new Set(files.filter((f) => anyMatch(rx, f)))];
    if (hits.length) items.push({ p, hits, base });
  }
  return { available: true, items };
}

function sourceFiles() {
  let files = git(['ls-files', '-co', '--exclude-standard']);
  files = files ? files.split('\n').filter(Boolean) : walk(ROOT).map(rel);
  const ign = matchers(CONFIG.ignoreSourceGlobs);
  return files.filter((f) => !f.startsWith('context/') && CONFIG.sourceExt.includes(path.extname(f)) && !CONFIG.ignoreDirs.some((d) => f.split('/').includes(d)) && !anyMatch(ign, f) && fs.existsSync(path.join(ROOT, f)));
}

/* --------------------------------------------------------------- commands */
const commands = {};

/* ------------------------------------------------------------------ detect */
commands.detect = () => {
  const d = detect(ROOT);
  emit({ command: 'detect', ok: true, ...d, groups: groupsFor(d, flags) }, () => {
    console.log(`project profile for ${ROOT}`);
    console.log(`  languages: ${d.langs.join(', ') || '—'}`);
    console.log(`  kinds:     ${d.kinds.join(', ') || '—'}${d.isMonorepo ? ' (workspaces detected)' : ''}`);
    console.log(`  signals:   ${d.signals.join(', ') || '—'}`);
    console.log(`  manifests: ${d.manifests.join(', ') || '—'}`);
    console.log(`  agent tools present: ${d.tools.join(', ') || '—'}`);
    console.log(`  scaffold groups: ${groupsFor(d, flags).join(', ')}`);
  });
};

/* ------------------------------------------------------------------- tools */
commands.tools = () => {
  const found = INTEL_TOOLS.map((t) => ({ ...t, available: false })).filter((t) => {
    try {
      t.available = !!t.probe();
    } catch {
      /* probe failed -> treat as unavailable */
    }
    return t.available;
  });
  emit({ command: 'tools', ok: true, available: found.map((t) => t.id), tools: found.map(({ probe, ...rest }) => rest) }, () => {
    console.log('Delegation targets — use these instead of hand-building the equivalent (references/tool-delegation.md):');
    if (!found.length) console.log('  (none found — ctx does map/coverage work by hand: parallel read-only subagents, see references/codebase-wiki.md)');
    for (const t of found) console.log(`  ✓ ${t.id}\n      best: ${t.best}\n      how:  ${t.how}`);
    console.log('\nRule: the tool produces, the wiki keeps — distill output into context/ pages, never paste raw dumps.');
  });
};

/* ---- install — copies this skill package into an agent tool's skills folder.
   Run it from a clone of the skill; only the shippable parts go. */
const TOOL_HOMES = { claude: ['.claude', 'skills'], qoder: ['.qoder', 'skills'] };
const SHIP = ['SKILL.md', 'references', 'assets', 'scripts'];
function copyTree(src, dst) {
  if (!fs.existsSync(src)) return;
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src)) copyTree(path.join(src, e), path.join(dst, e));
  } else fs.copyFileSync(src, dst);
}
commands.install = () => {
  const skillMd = path.join(SKILL_DIR, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return die('install must run from the cloned skill repo (no SKILL.md beside scripts/)');
  const name = String(parseFrontmatter(fs.readFileSync(skillMd, 'utf8')).data.name || path.basename(SKILL_DIR));
  const home = os.homedir();
  let targets;
  if (flags.dest && flags.dest !== true) targets = [path.resolve(String(flags.dest), name)];
  else {
    const tool = flags.tool && flags.tool !== true ? String(flags.tool) : 'auto';
    if (tool === 'auto') {
      targets = Object.values(TOOL_HOMES).filter(([d]) => fs.existsSync(path.join(home, d))).map(([d, sub]) => path.join(home, d, sub, name));
      if (!targets.length) return die(`no supported tool home found in ${home} (~/.claude or ~/.qoder) — pass --tool claude|qoder or --dest <dir>`);
    } else if (TOOL_HOMES[tool]) targets = [path.join(home, TOOL_HOMES[tool][0], TOOL_HOMES[tool][1], name)];
    else return die(`unknown --tool "${tool}" — use claude|qoder|auto, or --dest <dir>`);
  }
  for (const dst of targets) {
    if (path.resolve(dst) === path.resolve(SKILL_DIR)) return die('refusing to install the skill onto itself');
    fs.mkdirSync(dst, { recursive: true });
    for (const item of SHIP) copyTree(path.join(SKILL_DIR, item), path.join(dst, item));
    console.log(`installed ${name} v${VERSION} → ${dst}`);
  }
  console.log('Next: in any project, tell the agent "set up the project context system" — or run node <install-dir>/scripts/ctx.mjs setup from the project root.');
};

/* ---- brief */
commands.brief = () => {
  if (!pos.length) return die('usage: ctx brief <file | feature | keywords...> [--limit N] [--budget TOKENS]');
  const limit = Number(flags.limit || 8);
  const budget = flags.budget ? Number(flags.budget) : Infinity;
  const terms = pos.flatMap((t) => t.toLowerCase().split(/[^a-z0-9_.\/-]+/)).filter((t) => t.length > 2);
  const scored = [];
  for (const p of pages()) {
    let score = 0;
    const why = [];
    const cov = matchers(p.data.covers);
    for (const raw of pos) {
      const f = raw.replace(/^\.\//, '');
      if (cov.length && anyMatch(cov, f)) {
        score += 100;
        why.push(`covers ${f}`);
      }
    }
    const title = String(p.data.title || '').toLowerCase();
    const summary = String(p.data.summary || '').toLowerCase();
    const tags = asList(p.data.tags).join(' ').toLowerCase();
    const body = p.body.toLowerCase();
    for (const t of terms) {
      if (title.includes(t)) (score += 6), why.push(`title~${t}`);
      if (tags.includes(t)) (score += 5), why.push(`tag~${t}`);
      if (summary.includes(t)) (score += 3), why.push(`summary~${t}`);
      if (p.rel.toLowerCase().includes(t)) score += 3;
      if (asList(p.data.covers).some((c) => String(c).toLowerCase().includes(t))) score += 2;
      const c = body.split(t).length - 1;
      if (c) score += Math.min(c, 4);
    }
    if (p.data.status === 'superseded' || p.data.status === 'archived') score = Math.floor(score / 4);
    const unfilled = /\{\{[^}]+\}\}/.test(stripCode(p.text));
    if (unfilled) {
      score = Math.floor(score / 3);
      why.push('UNFILLED template');
    }
    if (score > 0) scored.push({ p, score, why: [...new Set(why)].slice(0, 3) });
  }
  scored.sort((a, b) => b.score - a.score);

  console.log('ALWAYS READ (orient):');
  let used = 0;
  for (const f of CONFIG.alwaysRead) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) continue;
    const t = tokens(fs.readFileSync(abs, 'utf8'));
    used += t;
    console.log(`  - ${f}  (~${fmtTok(t)} tok)`);
  }
  console.log('\nTASK-RELEVANT (read in this order, stop when you have enough):');
  let n = 0;
  for (const s of scored) {
    if (n >= limit) break;
    const t = tokens(s.p.text);
    if (used + t > budget && n > 0) continue;
    used += t;
    n++;
    console.log(`  ${n}. ${s.p.rel}  [${s.p.data.type || '?'}${s.p.data.status ? '/' + s.p.data.status : ''}, ~${fmtTok(t)} tok]  ${s.why.length ? '(' + s.why.join(', ') + ')' : ''}`);
    if (s.p.data.summary) console.log(`     ${s.p.data.summary}`);
    for (const l of tldr(s.p, 2)) console.log(`     > ${l.replace(/^[-*]\s*/, '')}`);
  }
  if (!n) console.log('  (no matching pages — grep the code, then CREATE a page for what you learn: ctx new <type> <name>)');
  console.log(`\nEstimated total: ~${fmtTok(used)} tokens. Read TL;DR first; open full pages only when needed.`);

  // Blind spot: a positional arg that looks like a file path but no page covers.
  const covering = pages().flatMap((p) => (p.data.status === 'superseded' || p.data.status === 'archived' ? [] : matchers(p.data.covers)));
  const blind = pos.filter((raw) => (raw.includes('/') || /\.[a-z0-9]+$/i.test(raw)) && !anyMatch(covering, raw.replace(/^\.\//, '')));
  if (blind.length) {
    console.log(`\nBLIND SPOT: no page documents ${blind.join(', ')}. After you read the code, capture what you learned: ctx new module <area> --covers "<glob>" (otherwise this stays invisible to the next session).`);
  }
};

/* ---- impact */
function impactData() {
  const dirty = dirtyFiles();
  let changed = new Set(dirty);
  if (flags.since) for (const f of git(['diff', '--name-only', String(flags.since), 'HEAD'])?.split('\n').filter(Boolean) || []) changed.add(f);
  else if (!dirty.size) for (const f of git(['diff', '--name-only', 'HEAD~1', 'HEAD'])?.split('\n').filter(Boolean) || []) changed.add(f);
  const all = [...changed];
  const code = all.filter((f) => !f.startsWith('context/') && !/^(AGENTS|CLAUDE|CLAUDE\.local|memory|GEMINI)\.md$/.test(f) && !f.startsWith('.claude/'));
  const touchedPages = new Set(all);
  const rows = [];
  const covered = new Set();
  for (const p of pages()) {
    if (['superseded', 'archived'].includes(p.data.status)) continue;
    const rx = matchers(p.data.covers);
    if (!rx.length) continue;
    const hits = code.filter((f) => anyMatch(rx, f));
    if (!hits.length) continue;
    hits.forEach((h) => covered.add(h));
    rows.push({ p, hits, updated: touchedPages.has(p.rel) });
  }
  const uncovered = code.filter((f) => !covered.has(f) && CONFIG.sourceExt.includes(path.extname(f)) && !anyMatch(matchers(CONFIG.ignoreSourceGlobs), f));
  const trackerTouched = ['context/progress-tracker.md', 'memory.md'].filter((f) => touchedPages.has(f));
  return { code, rows, uncovered, trackerTouched, all };
}
commands.impact = () => {
  if (!HAS_GIT()) return die('impact needs a git repository');
  const { code, rows, uncovered, trackerTouched } = impactData();
  const clean = !rows.some((r) => !r.updated) && !uncovered.length && !!trackerTouched.length;
  emit({ command: 'impact', ok: clean, changedCode: code.length, uncovered, trackerTouched, pages: rows.map((r) => ({ page: r.p.rel, updated: r.updated, hits: r.hits })) }, () => {
    console.log(`IMPACT — ${code.length} changed code file(s)`);
    if (!rows.length) console.log('  (no page covers the changed files)');
    for (const r of rows) console.log(`  ${r.updated ? '✓ updated ' : '✗ REVIEW  '} ${r.p.rel}   <- ${r.hits.slice(0, 3).join(', ')}${r.hits.length > 3 ? ` +${r.hits.length - 3}` : ''}`);
    if (uncovered.length) {
      console.log('\nUNCOVERED changed files (no page documents them — add to a page\'s `covers:` or create a page):');
      uncovered.slice(0, 15).forEach((f) => console.log('  ? ' + f));
    }
    console.log(`\nTracker/memory touched: ${trackerTouched.length ? trackerTouched.join(', ') : 'NO — update progress-tracker.md and memory.md'}`);
  });
  if (flags.check && !clean) process.exit(2);
};

/* ---- stale */
commands.stale = () => {
  const r = staleReport();
  emit({ command: 'stale', ok: !r.available || !r.items.length, git: r.available, items: r.items.map((i) => ({ page: i.p.rel, hits: i.hits })) }, () => {
    if (!r.available) return console.log('git not available — staleness detection skipped');
    if (!r.items.length) return console.log('No stale pages. ✔');
    console.log(`${r.items.length} stale page(s) — covered code changed after the page was last updated:`);
    for (const { p, hits } of r.items) console.log(`  ! ${p.rel}\n      ${hits.slice(0, 4).join(', ')}${hits.length > 4 ? ` +${hits.length - 4} more` : ''}`);
    console.log('\nFix: re-read the page against the code, edit what is wrong, then `ctx stamp <page>`.');
  });
  if (flags.strict && r.available && r.items.length) process.exit(1);
};

/* ---- lint */
const DECISION_FIELDS = ['Trigger', 'Options considered', 'Chosen', 'Lost alternative', 'Cost paid', 'Reversibility', 'Correctness policy'];
commands.lint = () => {
  if (flags.fix) commands.index();
  const errors = [];
  const warns = [];
  const E = (m) => errors.push(m);
  const W = (m) => warns.push(m);
  const ps = pages();
  if (!fs.existsSync(CTX)) return die('no context/ folder — run: node <skill>/scripts/ctx.mjs init');
  const required = ['title', 'type', 'status', 'summary', 'updated'];
  const statuses = ['draft', 'active', 'in-progress', 'complete', 'stale', 'superseded', 'archived'];
  const slugs = new Map();
  for (const p of ps) {
    slugs.set(path.basename(p.rel, '.md').toLowerCase(), p);
    if (p.data.title) slugs.set(String(p.data.title).toLowerCase(), p);
  }

  for (const p of ps) {
    if (!p.has) {
      E(`${p.rel}: missing frontmatter (title, type, status, summary, updated)`);
      continue;
    }
    for (const k of required) if (!p.data[k]) E(`${p.rel}: frontmatter missing \`${k}\``);
    if (p.data.status && !statuses.includes(p.data.status)) W(`${p.rel}: unknown status \`${p.data.status}\` (use ${statuses.join('|')})`);
    if (p.data.summary && String(p.data.summary).length > CONFIG.maxSummaryChars) W(`${p.rel}: summary > ${CONFIG.maxSummaryChars} chars (it is the index line — keep it tight)`);
    if (p.lines > CONFIG.maxPageLines) W(`${p.rel}: ${p.lines} lines > ${CONFIG.maxPageLines} — split it into focused pages`);
    if (p.lines > 40 && !/##\s*TL;DR/i.test(p.body)) W(`${p.rel}: no "## TL;DR" section (progressive disclosure: 3-5 lines an agent can stop at)`);
    if (p.data.status === 'superseded' && !p.data.superseded_by) W(`${p.rel}: superseded but no \`superseded_by\``);
    if (p.data.updated && !/^\d{4}-\d{2}-\d{2}/.test(String(p.data.updated)) && !/\{\{/.test(String(p.data.updated))) W(`${p.rel}: \`updated\` should be YYYY-MM-DD`);
    if (asList(p.data.covers).length) {
      const rx = matchers(p.data.covers);
      const files = sourceFilesAll();
      for (const g of asList(p.data.covers)) {
        if (/\{\{/.test(g)) continue;
        const r1 = globToRegex(String(g));
        if (!files.some((f) => r1.test(f))) W(`${p.rel}: covers \`${g}\` matches no file (dead pointer — fix or remove)`);
      }
      void rx;
    }
    if (/\{\{[^}]+\}\}/.test(stripCode(p.text))) (flags.strict ? E : W)(`${p.rel}: unfilled {{placeholder}} — fill it or delete the section`);
    // machine-specific absolute paths make committed files unportable — everything is project-relative
    if (/(?:^|[\s(`"'=])(?:[A-Za-z]:[\\/]|\/(?:Users|home)\/[^\s)`"']+)/.test(stripCode(p.text))) W(`${p.rel}: machine-specific absolute path — use project-relative paths (ctx commands run from the project root: node context/ctx.mjs …)`);

    // links
    const clean = stripCode(p.text);
    for (const m of clean.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const href = m[1].split('#')[0];
      if (!href || /^[a-z]+:/i.test(href) || href.startsWith('mailto:')) continue;
      const target = href.startsWith('/') ? path.join(ROOT, href) : path.resolve(path.dirname(p.abs), href);
      if (!fs.existsSync(target)) E(`${p.rel}: broken link -> ${m[1]}`);
    }
    for (const m of clean.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
      const k = m[1].trim().toLowerCase();
      if (!slugs.has(k)) E(`${p.rel}: broken wikilink [[${m[1]}]]`);
    }
  }

  // index completeness / orphans
  const idxPath = path.join(CTX, 'index.md');
  if (!fs.existsSync(idxPath)) E('context/index.md missing — it is the router every session reads first');
  else {
    const idx = fs.readFileSync(idxPath, 'utf8');
    if (!idx.includes('<!-- ctx:index:start -->')) W('context/index.md has no ctx:index markers — `ctx index` cannot regenerate the catalog');
    for (const p of ps) if (p.has && !['superseded', 'archived'].includes(p.data.status) && !idx.includes(p.relCtx)) W(`${p.rel}: orphan — not in context/index.md (run \`ctx index\`)`);
  }

  // decisions
  const dec = ps.find((p) => p.rel === 'context/decisions.md');
  if (dec) {
    const ids = [...dec.text.matchAll(/^##\s+D-(\d+)/gm)].map((m) => m[1]);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length) E(`context/decisions.md: duplicate decision id(s) D-${[...new Set(dup)].join(', D-')}`);
    const known = new Set(ids);
    for (const p of ps) for (const m of stripCode(p.text).matchAll(/\bD-(\d{2,})\b/g)) if (!known.has(m[1]) && p.rel !== 'context/decisions.md' && !/NN/.test(m[0])) W(`${p.rel}: references D-${m[1]} which does not exist in decisions.md`);
    // completeness: every real (filled) D-NN record must carry all fields
    const blocks = dec.text.split(/\n(?=##\s)/).filter((b) => /^##\s+D-\d+/.test(b));
    for (const b of blocks) {
      if (/\{\{/.test(b)) continue; // unfilled template entry — the placeholder lint already covers it
      const id = (b.match(/^##\s+D-(\d+)/) || [])[1];
      const missing = DECISION_FIELDS.filter((f) => !new RegExp(`^${f}\\s*:`, 'm').test(b));
      if (missing.length) E(`context/decisions.md: D-${id} missing field(s): ${missing.join(', ')}`);
    }
  }

  // specs claimed complete but with unticked verification boxes
  for (const p of ps) {
    if (p.data.type === 'feature' && p.data.status === 'complete') {
      const unticked = (p.body.match(/^\s*[-*]\s*\[ ]/gm) || []).length;
      if (unticked) E(`${p.rel}: status is complete but ${unticked} verification check(s) still unticked — tick or reopen the status`);
    }
  }

  // tracker mutual exclusivity + every tracked unit must have a spec
  const tr = ps.find((p) => p.rel === 'context/progress-tracker.md');
  if (tr) {
    const sect = (name) => (tr.text.match(new RegExp(`##\\s*${name}[^\\n]*\\n([\\s\\S]*?)(?:\\n##\\s|$)`, 'i')) || [])[1] || '';
    const feats = (s) => new Set([...s.matchAll(/Feature\s+(\d+)/gi)].map((m) => m[1]));
    const a = feats(sect('In progress'));
    const bl = feats(sect('Blocked'));
    const b = feats(sect('Completed'));
    const both = [...a].filter((x) => b.has(x) || bl.has(x)).concat([...bl].filter((x) => b.has(x)));
    if (both.length) E(`progress-tracker.md: Feature ${[...new Set(both)].join(', ')} appears in two states (In progress / Blocked / Completed must be exclusive)`);
    if (a.size > 1) W(`progress-tracker.md: ${a.size} features In progress — one unit at a time per agent/branch (ctx task start enforces this)`);
    // same-section duplicates = two branches claimed the same number (multi-user merge collision)
    const specDir = path.join(CTX, 'feature-specs');
    for (const s of ['In progress', 'Blocked', 'Up next', 'Completed']) {
      const ids = [...sect(s).matchAll(/Feature\s+(\d+)/gi)].map((m) => m[1]);
      const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      if (dup.length) E(`progress-tracker.md: Feature ${[...new Set(dup)].join(', ')} listed twice under ${s} — branch merge collision: keep one line per unit, renumber the other spec`);
    }
    const specNums = fs.existsSync(specDir) ? fs.readdirSync(specDir).filter((f) => /^\d+/.test(f)).map((f) => f.match(/^(\d+)/)[1]) : [];
    const sdup = specNums.filter((x, i) => specNums.indexOf(x) !== i);
    if (sdup.length) W(`feature-specs/: number ${[...new Set(sdup)].join(', ')} used by two specs (branch merge) — renumber one and update its tracker line`);
    const hasSpec = (id) => fs.existsSync(specDir) && fs.readdirSync(specDir).some((f) => f.startsWith(String(id).padStart(2, '0')));
    for (const id of new Set([...a, ...b, ...feats(sect('Up next')), ...feats(sect('Blocked'))])) {
      if (!hasSpec(id)) (a.has(id) || b.has(id) ? E : W)(`progress-tracker.md: Feature ${id} is tracked but has no spec in context/feature-specs/ — create one (ctx new feature <name>) or remove the line`);
    }
  }

  // instruction files
  const agents = path.join(ROOT, 'AGENTS.md');
  if (!fs.existsSync(agents)) E('AGENTS.md missing — the schema file every agent reads');
  else {
    const n = fs.readFileSync(agents, 'utf8').split('\n').length;
    if (n > CONFIG.maxAgentsLines) W(`AGENTS.md is ${n} lines > ${CONFIG.maxAgentsLines} — move detail into context/ and link to it`);
    if (!/context\/index\.md/.test(fs.readFileSync(agents, 'utf8'))) W('AGENTS.md does not route through context/index.md');
  }
  const claude = path.join(ROOT, 'CLAUDE.md');
  if (fs.existsSync(claude) && !fs.readFileSync(claude, 'utf8').trimStart().startsWith('@AGENTS.md')) W('CLAUDE.md should start with `@AGENTS.md` (one source of truth, no drift)');
  for (const legacy of ['.cursorrules', '.windsurfrules', 'AGENT.md']) if (fs.existsSync(path.join(ROOT, legacy))) W(`${legacy}: legacy instruction file shadows/duplicates AGENTS.md — delete or migrate`);
  if (!fs.existsSync(path.join(CTX, 'log.md'))) W('context/log.md missing (append-only activity timeline)');

  // staleness
  const st = staleReport();
  for (const { p, hits } of st.items) W(`${p.rel}: STALE — ${hits.length} covered file(s) changed since it was last updated (${hits[0]}${hits.length > 1 ? ', …' : ''})`);

  // secrets heuristic
  for (const p of ps) if (/(sk_live_|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/.test(p.text)) E(`${p.rel}: looks like a secret/token — names of env vars only, never values`);

  const bad = errors.length || (flags.strict && warns.length) ? 1 : 0;
  emit({ command: 'lint', ok: !bad, pages: ps.length, errors, warns, exitCode: bad }, () => {
    errors.forEach((m) => console.log(`ERROR ${m}`));
    warns.forEach((m) => console.log(`WARN  ${m}`));
    console.log(`\nctx lint: ${ps.length} pages · ${errors.length} error(s) · ${warns.length} warning(s)`);
    if (bad) process.exit(1);
  });
};
let _all;
function sourceFilesAll() {
  if (_all) return _all;
  let f = git(['ls-files', '-co', '--exclude-standard']);
  _all = f ? f.split('\n').filter(Boolean) : walk(ROOT).map(rel);
  return _all;
}

/* ---- index */
const IDX_START = '<!-- ctx:index:start -->';
const IDX_END = '<!-- ctx:index:end -->';
const TYPE_ORDER = ['overview', 'architecture', 'plan', 'standards', 'guide', 'module', 'entity', 'api', 'integration', 'feature', 'decision-log', 'tracker', 'ui', 'runbook', 'glossary', 'source', 'query'];
commands.index = () => {
  const ps = pages().filter((p) => p.has && !['superseded', 'archived'].includes(p.data.status));
  const groups = new Map();
  for (const p of ps) {
    const t = p.data.type || 'other';
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(p);
  }
  const order = [...groups.keys()].sort((a, b) => (TYPE_ORDER.indexOf(a) + 100) % 100 - (TYPE_ORDER.indexOf(b) + 100) % 100 || a.localeCompare(b));
  let md = `${IDX_START}\n_Generated by \`ctx index\` on ${today()} — ${ps.length} pages. Do not hand-edit between the markers._\n`;
  for (const t of order) {
    md += `\n### ${t}\n`;
    for (const p of groups.get(t)) {
      const unf = /\{\{[^}]+\}\}/.test(stripCode(p.text)) ? ' _(unfilled)_' : '';
      const flag = (p.data.confidence && p.data.confidence !== 'verified' ? ` _(${p.data.confidence})_` : '') + unf;
      md += `- [${p.data.title || p.relCtx}](${p.relCtx}) — ${p.data.summary || 'no summary'}${flag}\n`;
    }
  }
  md += `${IDX_END}`;
  const idxPath = path.join(CTX, 'index.md');
  let cur = fs.existsSync(idxPath) ? fs.readFileSync(idxPath, 'utf8') : `---\ntitle: Context Index\ntype: overview\nstatus: active\nsummary: Router and catalog — the first context file every session reads\nupdated: ${today()}\n---\n\n# Context Index\n\n${IDX_START}\n${IDX_END}\n`;
  if (!cur.includes(IDX_START)) cur += `\n${IDX_START}\n${IDX_END}\n`;
  cur = cur.replace(new RegExp(`${IDX_START}[\\s\\S]*?${IDX_END}`), () => md);
  cur = upsertFm(cur, 'updated', today());
  fs.writeFileSync(idxPath, cur);
  console.log(`index: ${ps.length} pages catalogued in context/index.md`);
  if (flags.llms) {
    let llms = `# ${path.basename(ROOT)}\n\n> Project context for LLMs. Start with AGENTS.md, then context/index.md. Each page below has a one-line summary.\n\n## Core\n- [AGENTS.md](AGENTS.md): instructions and invariants for any agent\n- [memory.md](memory.md): current state and exact next step\n- [context/index.md](context/index.md): task routing + full catalog\n\n## Pages\n`;
    for (const p of ps) llms += `- [${p.data.title || p.relCtx}](${p.rel}): ${p.data.summary || ''}\n`;
    fs.writeFileSync(path.join(ROOT, 'llms.txt'), llms);
    console.log('index: wrote llms.txt');
  }
};

/* ---- coverage */
commands.coverage = () => {
  const rx = pages().filter((p) => !['superseded', 'archived'].includes(p.data.status)).flatMap((p) => matchers(p.data.covers));
  const files = sourceFiles();
  const unc = files.filter((f) => !anyMatch(rx, f));
  const pct = files.length ? Math.round(((files.length - unc.length) / files.length) * 100) : 100;
  const byDir = new Map();
  for (const f of unc) {
    const d = f.split('/').slice(0, Math.min(3, f.split('/').length - 1)).join('/') || '.';
    byDir.set(d, (byDir.get(d) || 0) + 1);
  }
  const spots = [...byDir.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => ({ dir: d + '/', files: n }));
  emit({ command: 'coverage', ok: pct >= 80, pct, documented: files.length - unc.length, total: files.length, blindSpots: spots }, () => {
    console.log(`Coverage: ${files.length - unc.length}/${files.length} source files documented (${pct}%)`);
    if (unc.length) console.log('\nBlind spots (uncovered files per directory) — each needs a module page or a `covers:` entry:');
    spots.slice(0, 25).forEach((s) => console.log(`  ${String(s.files).padStart(4)}  ${s.dir}`));
  });
  if (flags.strict && pct < 80) process.exit(1);
};

/* ---- log */
commands.log = () => {
  const lp = path.join(CTX, 'log.md');
  if (flags.tail) {
    const t = fs.existsSync(lp) ? fs.readFileSync(lp, 'utf8').split(/\n(?=## \[)/).filter((s) => s.startsWith('## [')) : [];
    return console.log(t.slice(-Number(flags.tail)).join('\n'));
  }
  const [op, ...title] = pos;
  if (!op || !title.length) return die('usage: ctx log <op> <title...> [-m "note"]   ops: ingest|query|lint|build|decision|fix|sync|audit|handoff');
  if (!fs.existsSync(lp)) fs.writeFileSync(lp, `---\ntitle: Activity Log\ntype: log\nstatus: active\nsummary: Append-only timeline of ingests, builds, decisions and lint passes\nupdated: ${today()}\n---\n\n# Log\n`);
  fs.appendFileSync(lp, `\n## [${today()}] ${op} | ${title.join(' ')}\n${flags.m && flags.m !== true ? flags.m + '\n' : ''}`);
  console.log(`logged: [${today()}] ${op} | ${title.join(' ')}`);
};

/* ---- task — the ledger lives IN progress-tracker.md; ctx keeps the states honest.
   States: In progress (max 1 — one unit at a time) · Blocked · Up next · Completed. */
const TASK_SECTIONS = ['In progress', 'Blocked', 'Up next', 'Completed'];
const escS = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function getSection(text, name) {
  const m = text.match(new RegExp(`^##[^\\n]*${escS(name)}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'im'));
  return m ? m[1] : null;
}
function setSection(text, name, body) {
  const rx = new RegExp(`(^##[^\\n]*${escS(name)}[^\\n]*\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'im');
  if (!rx.test(text)) return `${text.replace(/\s+$/, '')}\n\n## ${name}\n\n${body.trim()}\n`;
  return text.replace(rx, (_all, head) => head + body);
}
const taskRx = (id) => new RegExp(`^[-*]\\s+(?:\\[[ x]\\]\\s*)?(?:\\*\\*)?Feature\\s+0*${id}\\b.*$`, 'im');
const isRealTask = (l) => /^[-*]\s+.*Feature\s+\d+/i.test(l) && !/\{\{/.test(l);
function taskTitle(line) {
  const m = line.match(/Feature\s+(\d+)[:*\s]*([^\u2014—]*)/i);
  return { id: String(m[1]).padStart(2, '0'), title: (m[2] || '').replace(/[-–—]\s(started|blocked).*/i, '').trim().replace(/\*\*/g, '').replace(/[:—-]\s*$/, '').trim() || 'untitled' };
}
commands.task = () => {
  const tp = path.join(CTX, 'progress-tracker.md');
  if (!fs.existsSync(tp)) return die('no context/progress-tracker.md — run ctx init first');
  let text = fs.readFileSync(tp, 'utf8');
  const sub = pos[0] || 'list';
  const argId = pos[1] ? String(pos[1]).replace(/^0+/, '').replace(/\D/g, '') : '';
  const note = (flags.m && flags.m !== true ? String(flags.m) : '') || pos.slice(2).join(' ');
  const findLine = (id) => {
    for (const s of TASK_SECTIONS) {
      const m = (getSection(text, s) || '').match(taskRx(id));
      if (m) return { s, line: m[0] };
    }
    return null;
  };
  const move = (id, to, line) => {
    const found = findLine(id);
    if (found) {
      for (const s of TASK_SECTIONS) {
        const body = getSection(text, s) || '';
        const m = body.match(taskRx(id));
        if (m) text = setSection(text, s, body.replace(m[0], ''));
      }
    }
    if (!found && !line) return null;
    const body = (getSection(text, to) || '').split('\n').filter((l) => !/\{\{Feature NN/.test(l)).join('\n');
    text = setSection(text, to, `${body.replace(/\s+$/, '')}\n- ${line}`.trimStart() + '\n');
    return found ? found.s : null;
  };
  if (sub === 'list') {
    const rows = {};
    for (const s of TASK_SECTIONS) rows[s] = ((getSection(text, s) || '').split('\n').filter(isRealTask));
    emit({ command: 'task', ok: rows['In progress'].length <= 1, sections: rows }, () => {
      for (const s of TASK_SECTIONS) console.log(`${s} (${rows[s].length}):\n${rows[s].map((l) => '  ' + l.trim()).join('\n') || '  —'}`);
    });
    return;
  }
  if (sub === 'add') {
    const title = pos.slice(1).join(' ') || (flags.title && flags.title !== true ? String(flags.title) : '');
    if (!title) return die('usage: ctx task add "title" [--spec NN]');
    let id = flags.spec && flags.spec !== true ? String(flags.spec).replace(/\D/g, '') : null;
    const usedNums = () => {
      const s = new Set();
      for (const sec of TASK_SECTIONS) for (const l of (getSection(text, sec) || '').split('\n')) {
        if (!isRealTask(l)) continue;
        const m = l.match(/Feature\s+(\d+)/i);
        if (m) s.add(Number(m[1]));
      }
      return s;
    };
    if (!id) {
      const used = usedNums();
      let n = 1;
      for (const u of used) if (u >= n) n = u + 1;
      id = String(n);
    } else if (usedNums().has(Number(id))) {
      return die(`Feature ${id} is already in the ledger (another branch's unit?) — pick a free number or omit --spec`);
    }
    id = id.padStart(2, '0');
    const body = (getSection(text, 'Up next') || '').split('\n').filter((l) => !/\{\{Feature NN/.test(l)).join('\n');
    text = setSection(text, 'Up next', `${body.replace(/\s+$/, '')}\n- Feature ${id}: ${title}`.trimStart() + '\n');
    console.log(`added Feature ${id}: ${title} → Up next`);
  } else if (sub === 'start') {
    if (!argId) return die('usage: ctx task start <NN> [--force]');
    const active = ((getSection(text, 'In progress') || '').split('\n').filter(isRealTask));
    if (active.length && !active[0].match(taskRx(argId)) && !flags.force) return die(`one unit at a time: ${active[0].trim()} is In progress. Finish it (ctx task done) or pass --force.`);
    const f = findLine(argId);
    if (!f) return die(`Feature ${argId} is not in the tracker — add it first: ctx task add "..."`);
    const title = taskTitle(f.line).title;
    move(argId, 'In progress', `Feature ${String(argId).padStart(2, '0')}: ${title} — started ${today()}`);
    console.log(`Feature ${argId} → In progress${f.s !== 'In progress' ? ` (was in ${f.s})` : ''}`);
  } else if (sub === 'block') {
    if (!argId) return die('usage: ctx task block <NN> "why + what unblocks it"');
    if (!note) return die('a blocked task must say why and what unblocks it: ctx task block <NN> "waiting on X"');
    const f = findLine(argId);
    if (!f) return die(`Feature ${argId} is not in the tracker`);
    move(argId, 'Blocked', `Feature ${String(argId).padStart(2, '0')}: ${taskTitle(f.line).title} — blocked: ${note}`);
    console.log(`Feature ${argId} → Blocked`);
  } else if (sub === 'done') {
    if (!argId) return die('usage: ctx task done <NN> -m "concrete details: versions, paths, env names"');
    if (!note) return die('done needs the concrete details: ctx task done <NN> -m "..." — vague completions rot the tracker');
    const f = findLine(argId);
    if (!f) return die(`Feature ${argId} is not in the tracker`);
    move(argId, 'Completed', `Feature ${String(argId).padStart(2, '0')}: ${taskTitle(f.line).title} — ${today()} — ${note}`);
    console.log(`Feature ${argId} → Completed`);
  } else return die('usage: ctx task list|add|start|block|done  (one unit at a time; done requires concrete details)');
  fs.writeFileSync(tp, upsertFm(text, 'updated', today()));
};

/* ---- archive — the growth valve: the wiki stays fast because old material moves out.
   log.md entries and tracker Completed lines older than the cutoff rotate into
   context/archive/ (still greppable forever); nothing is ever deleted. */
commands.archive = () => {
  const dry = !!flags['dry-run'];
  const logDays = Number(flags.days || CONFIG.archiveAfterDays || 180);
  const trkDays = Number(flags['keep-days'] || CONFIG.trackerKeepDays || 90);
  const cutoff = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  const cl = cutoff(logDays), ct = cutoff(trkDays);
  const moved = { log: 0, tracker: 0 };
  const lp = path.join(CTX, 'log.md');
  if (fs.existsSync(lp)) {
    const text = fs.readFileSync(lp, 'utf8');
    const keep = [];
    const old = [];
    for (const entry of text.split(/\n(?=## \[)/)) {
      const m = entry.match(/^## \[(\d{4}-\d{2}-\d{2})\]/);
      if (m && m[1] < cl) old.push({ date: m[1], text: entry.trimEnd() });
      else keep.push(entry);
    }
    if (old.length) {
      moved.log = old.length;
      if (!dry) {
        const ap = path.join(CTX, 'archive', `log-${cl.slice(0, 7)}.md`);
        if (!fs.existsSync(ap)) fs.writeFileSync(ap, `---\ntitle: Activity Log (archived before ${cl})\ntype: log\nstatus: archived\nsummary: Rotated out of context/log.md by ctx archive on ${today()} — still greppable\nupdated: ${today()}\n---\n\n# Log (archived)\n`);
        fs.appendFileSync(ap, '\n' + old.map((o) => o.text).join('\n') + '\n');
        fs.writeFileSync(lp, keep.join('\n'));
      }
      console.log(`log: ${old.length} entr${old.length === 1 ? 'y' : 'ies'} older than ${cl} → context/archive/log-${cl.slice(0, 7)}.md`);
    } else console.log(`log: nothing older than ${cutoff(logDays)} days (${cl})`);
  }
  const tp = path.join(CTX, 'progress-tracker.md');
  if (fs.existsSync(tp)) {
    let text = fs.readFileSync(tp, 'utf8');
    const body = getSection(text, 'Completed');
    if (body) {
      const lines = body.split('\n');
      const keepLines = [];
      const movedLines = [];
      for (const l of lines) {
        const m = l.match(/(\d{4}-\d{2}-\d{2})/);
        if (isRealTask(l) && m && m[1] < ct) movedLines.push(l);
        else keepLines.push(l);
      }
      if (movedLines.length) {
        moved.tracker = movedLines.length;
        if (!dry) {
          const ap = path.join(CTX, 'archive', `tracker-${ct.slice(0, 4)}.md`);
          if (!fs.existsSync(ap)) fs.writeFileSync(ap, `---\ntitle: Completed Work (archived ${ct.slice(0, 4)})\ntype: tracker\nstatus: archived\nsummary: Completions older than ${ct}, rotated by ctx archive — concrete details preserved, greppable\nupdated: ${today()}\n---\n\n# Completed (archived)\n`);
          fs.appendFileSync(ap, '\n' + movedLines.join('\n') + '\n');
          const pointer = `- (older completions archived: ${rel(path.join(CTX, 'archive', `tracker-${ct.slice(0, 4)}.md`))})`;
          if (!keepLines.some((l) => l.includes('older completions archived'))) keepLines.push(pointer);
          text = setSection(text, 'Completed', keepLines.join('\n'));
          fs.writeFileSync(tp, upsertFm(text, 'updated', today()));
        }
        console.log(`tracker: ${movedLines.length} old completion(s) → context/archive/tracker-${ct.slice(0, 4)}.md (pointer left behind)`);
      } else console.log(`tracker: nothing completed before ${ct}`);
    }
  }
  const dec = path.join(CTX, 'decisions.md');
  if (fs.existsSync(dec)) {
    const n = fs.readFileSync(dec, 'utf8').split('\n').length;
    if (n > CONFIG.maxPageLines) console.log(`decisions: ${n} lines — when a page this central grows, split by year: move the oldest D-NN blocks to context/archive/decisions-<year>.md (keep IDs stable — pages link them) and leave a pointer line`);
  }
  if (!dry && (moved.log || moved.tracker)) commands.index();
  console.log(moved.log || moved.tracker ? (dry ? 'dry run — nothing written' : 'archive: done (history is never deleted, only moved out of the hot path)') : 'archive: everything is within the keep window');
};

/* ---- stamp */
commands.stamp = () => {
  const sha = git(['rev-parse', 'HEAD']);
  let targets = pos.map((t) => path.resolve(ROOT, t));
  if (flags.touched) targets = [...dirtyFiles()].filter((f) => f.startsWith('context/') && f.endsWith('.md')).map((f) => path.join(ROOT, f));
  if (!targets.length) return die('usage: ctx stamp <page...> | --touched');
  for (const t of targets) {
    if (!fs.existsSync(t) || !isPageFile(t)) {
      console.log(`skip ${t}`);
      continue;
    }
    let txt = fs.readFileSync(t, 'utf8');
    txt = upsertFm(txt, 'updated', today());
    if (sha) txt = upsertFm(txt, 'verified_at', sha.slice(0, 12));
    fs.writeFileSync(t, txt);
    console.log(`stamped ${rel(t)}${sha ? ' @ ' + sha.slice(0, 7) : ''}`);
  }
};

/* ---- new */
const SKELETONS = {
  module: (t, slug, covers) => `---\ntitle: ${t}\ntype: module\nstatus: draft\nsummary: TODO one line — what this module owns\ntags: [${slug}]\ncovers: [${covers || `src/${slug}/**`}]\nrelated: []\nupdated: ${today()}\nconfidence: inferred\n---\n\n# ${t}\n\n## TL;DR\n- Owns: TODO\n- Entry points: TODO (file → exported symbol)\n- Biggest gotcha: TODO\n\n## Responsibilities\n\n## Public surface\n| Symbol / route | File | Contract |\n|---|---|---|\n\n## Data flow\n\n## Depends on / used by\n\n## Gotchas & invariants\n\n## Tests\n\n## Open questions\n`,
  feature: (t, slug, covers) => `---\ntitle: ${t}\ntype: feature\nstatus: draft\nsummary: TODO one line — the measurable goal\ntags: [${slug}]\ncovers: [${covers || ''}]\nrelated: []\nupdated: ${today()}\n---\n\n# ${t}\n\n## TL;DR\n- Goal: TODO\n- Boundary: TODO (one system boundary)\n\n## What to build\n\n## Explicitly NOT in this spec\n\n## Clarifications\n\n## Value sources\n| Value | Comes from |\n|---|---|\n\n## Verification checklist\n- [ ] build + lint + typecheck pass\n- [ ] flow driven for real\n- [ ] context pages updated (ctx impact shows no ✗)\n`,
  source: (t) => `---\ntitle: ${t}\ntype: source\nstatus: active\nsummary: TODO one line — what this source says and why it matters\ntags: []\nraw: context/raw/TODO\nupdated: ${today()}\n---\n\n# ${t}\n\n## TL;DR\n\n## Key claims\n\n## Pages updated because of this source\n\n## Contradictions with existing pages\n`,
};
commands.new = () => {
  const [type, ...rest] = pos;
  if (!type || !rest.length) return die('usage: ctx new <module|feature|source|type> <name> [--covers "src/a/**,src/b.ts"] [--title "Title"]');
  const slug = rest.join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const title = flags.title && flags.title !== true ? String(flags.title) : rest.join(' ').replace(/^./, (c) => c.toUpperCase());
  const covers = flags.covers && flags.covers !== true ? String(flags.covers).split(',').map((s) => s.trim()).join(', ') : '';
  let dest;
  if (type === 'module') dest = path.join(CTX, 'codebase', 'modules', `${slug}.md`);
  else if (type === 'feature') {
    const dir = path.join(CTX, 'feature-specs');
    const n = fs.existsSync(dir) ? Math.max(0, ...fs.readdirSync(dir).map((f) => parseInt(f, 10)).filter((x) => !isNaN(x))) + 1 : 1;
    dest = path.join(dir, `${String(n).padStart(2, '0')}-${slug}.md`);
  } else if (type === 'source') dest = path.join(CTX, 'sources', `${slug}.md`);
  else dest = path.join(CTX, `${slug}.md`);
  if (fs.existsSync(dest)) return die(`${rel(dest)} already exists`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const sk = SKELETONS[type] || ((t, s) => `---\ntitle: ${t}\ntype: ${type}\nstatus: draft\nsummary: TODO one line\ntags: [${s}]\ncovers: []\nupdated: ${today()}\n---\n\n# ${t}\n\n## TL;DR\n\n`);
  fs.writeFileSync(dest, sk(title, slug, covers));
  console.log(`created ${rel(dest)} — fill TODOs, then run: ctx index`);
};

/* ---- doctor: is the scaffold actually wired (not just present)? */
commands.doctor = () => {
  const checks = [];
  const C = (ok, label, fix) => checks.push({ ok, label, fix: ok ? '' : fix });
  const read = (p) => {
    try {
      return fs.readFileSync(path.join(ROOT, p), 'utf8');
    } catch {
      return '';
    }
  };
  C(fs.existsSync(path.join(ROOT, 'AGENTS.md')), 'AGENTS.md present', 'run ctx init');
  const claude = read('CLAUDE.md');
  C(!claude || /^\s*@AGENTS\.md\s*$/m.test(claude), 'CLAUDE.md imports AGENTS.md', 'first line of CLAUDE.md must be `@AGENTS.md` (single source of truth)');
  C(fs.existsSync(path.join(CTX, 'index.md')) && read('context/index.md').includes('<!-- ctx:index:start -->'), 'context/index.md has ctx markers', 'run ctx index');
  C(fs.existsSync(path.join(CTX, 'ctx.mjs')), 'context/ctx.mjs present', 'copy scripts/ctx.mjs to context/');
  const gi = read('.gitignore');
  C(/context\/current-issues\.md/.test(gi), '.gitignore covers current-issues.md', 'add `context/current-issues.md` to .gitignore (pasted errors leak tokens)');
  C(/CLAUDE\.local\.md/.test(gi), '.gitignore covers CLAUDE.local.md', 'add `CLAUDE.local.md` to .gitignore');
  let settings = null;
  try {
    settings = JSON.parse(read('.claude/settings.json'));
  } catch {}
  if (settings) {
    const deny = (settings.permissions && settings.permissions.deny) || [];
    C(deny.some((r) => /\.env/.test(r)), 'settings.json denies .env reads', 'add a deny rule like `Read(**/.env*)`');
    const hooks = settings.hooks || {};
    const flat = JSON.stringify(hooks);
    C(/SessionStart/.test(flat), 'SessionStart hook wired', 'wire `ctx hook session-start` in .claude/settings.json hooks');
    C(/Stop/.test(flat), 'Stop hook wired', 'wire `ctx hook stop` in .claude/settings.json hooks');
  } else {
    C(false, '.claude/settings.json parses', 'fix or re-run ctx init');
  }
  const cfgJ = (() => {
    try {
      return JSON.parse(read('context/.ctx.json'));
    } catch {
      return null;
    }
  })();
  C(!cfgJ || cfgJ.setupVersion === VERSION, `project tooling at skill version ${VERSION}`, `project was set up by ${cfgJ.setupVersion || 'an older version'} — re-run: node <skill>/scripts/ctx.mjs setup --root . (idempotent upgrade)`);
  const dr = detect(ROOT);
  const expectRules = uiOn(dr, {}) || dr.signals.includes('backend') || dr.signals.includes('db') || dr.langs.some((l) => l !== 'docs');
  C(!expectRules || fs.existsSync(path.join(ROOT, '.claude', 'rules')), '.claude/rules/ path-gated rules present', 're-run ctx setup to generate them');
  C(!fs.existsSync(path.join(CTX, 'agents')) || fs.existsSync(path.join(CTX, 'agents', 'context-explorer', 'MEMORY.md')), 'subagent memory wired', 're-run ctx setup to scaffold context/agents/*/MEMORY.md');
  const fails = checks.filter((c) => !c.ok);
  emit({ command: 'doctor', ok: !fails.length, checks }, () => {
    for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.label}${c.ok ? '' : ' — ' + c.fix}`);
    console.log(`\nctx doctor: ${checks.length - fails.length}/${checks.length} checks pass`);
  });
  if (fails.length) process.exit(1);
};

/* ---- status */
commands.status = () => {
  const ps = pages();
  const byType = {};
  for (const p of ps) byType[p.data.type || '?'] = (byType[p.data.type || '?'] || 0) + 1;
  const st = staleReport();
  const files = sourceFiles();
  const rx = ps.flatMap((p) => matchers(p.data.covers));
  const cov = files.length ? Math.round((files.filter((f) => anyMatch(rx, f)).length / files.length) * 100) : 100;
  const always = CONFIG.alwaysRead.map((f) => (fs.existsSync(path.join(ROOT, f)) ? tokens(fs.readFileSync(path.join(ROOT, f), 'utf8')) : 0)).reduce((a, b) => a + b, 0);
  const tr = ps.find((p) => p.rel === 'context/progress-tracker.md');
  const inProgress = tr ? ((tr.text.match(/##\s*In progress[^\n]*\n([\s\S]*?)(?:\n##\s|$)/i) || [])[1] || '').split('\n').filter((l) => l.trim().startsWith('-') && !/\{\{/.test(l)).map((l) => l.trim()) : [];
  const logPath = path.join(CTX, 'log.md');
  const recent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split(/\n(?=## \[)/).filter((s) => s.startsWith('## [')).slice(-3) : [];
  emit({ command: 'status', ok: !(st.available && st.items.length), pages: ps.length, byType, stale: st.available ? st.items.length : null, coveragePct: cov, sourceFiles: files.length, orientTokens: always, inProgress, recentLog: recent }, () => {
    console.log(`pages: ${ps.length}  (${Object.entries(byType).map(([k, v]) => `${k}:${v}`).join(' ')})`);
    console.log(`stale: ${st.available ? st.items.length : 'n/a (no git)'}   code coverage: ${cov}% of ${files.length} source files`);
    console.log(`orient cost (always-read): ~${fmtTok(always)} tokens`);
    console.log(`in progress: ${inProgress.join(' | ') || '—'}`);
    console.log('recent log:');
    for (const e of recent) console.log(e.replace(/\n(?!## )/g, '\n  ').trimEnd());
  });
};

/* ---- hooks */
commands.hook = () => {
  const which = pos[0];
  let input = {};
  try {
    if (!process.stdin.isTTY) input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {}
  if (which === 'session-start') {
    if (input.source === 'compact') console.log('[project-context-system] Context was compacted — your memory of this session is lossy. Re-read the files below before continuing; trust the tracker and memory.md over recall.');
    const mem = path.join(ROOT, 'memory.md');
    let next = '';
    if (fs.existsSync(mem)) {
      const m = fs.readFileSync(mem, 'utf8').match(/##\s*Next step\s*\n([\s\S]*?)(?:\n##\s|$)/i);
      if (m) next = m[1].split('\n').filter((l) => l.trim() && !/\{\{/.test(l)).slice(0, 4).join(' ').trim();
    }
    const st = staleReport();
    console.log('[project-context-system] ORIENT: read AGENTS.md -> context/index.md -> memory.md. Do NOT scan the repo. For any task run `node context/ctx.mjs brief <files|keywords>` and read only what it returns (TL;DR first).');
    if (next) console.log(`Next step (from memory.md): ${next}`);
    if (st.available && st.items.length) console.log(`Context health: ${st.items.length} stale page(s) (${st.items.slice(0, 3).map((i) => i.p.relCtx).join(', ')}) — verify against code before trusting them.`);
    console.log('RECORD as you work: ctx task start/done (the ledger), decisions.md (hard calls), current-issues.md (bugs), `ctx impact` before finishing, memory.md at the end.');
    return;
  }
  if (which === 'stop') {
    if (input.stop_hook_active) return; // never loop
    if (!HAS_GIT()) return;
    const { code, rows, trackerTouched } = impactData();
    if (!code.length) return; // nothing changed -> allow stop
    const problems = [];
    const stale = rows.filter((r) => !r.updated);
    if (stale.length) problems.push(`Context pages not updated for changed code: ${stale.slice(0, 6).map((r) => r.p.rel).join(', ')}. Update them (or confirm nothing they describe changed) then run \`node context/ctx.mjs stamp <page>\`.`);
    if (!trackerTouched.length) problems.push('Neither context/progress-tracker.md nor memory.md was updated this session.');
    if (problems.length) {
      process.stderr.write('[project-context-system] Before ending the session:\n- ' + problems.join('\n- ') + '\n');
      process.exit(2);
    }
    return;
  }
  die('usage: ctx hook session-start|stop');
};

/* ---- init — dynamic: what gets scaffolded is decided by the project, not by assumption */
function groupsFor(d, f = {}) {
  const g = ['core'];
  if (uiOn(d, f)) g.push('ui');
  if (fullOn(d, f)) g.push('full');
  if (f.pointers) g.push('pointers');
  return g;
}
const uiOn = (d, f) => !f['no-ui'] && (f.ui || d.signals.includes('ui') || d.signals.includes('mobile'));
const fullOn = (d, f) => !f['no-full'] && (f.full || d.langs.some((l) => l !== 'docs'));

const INIT_MAP = [
  // [asset, dest, when(profile, flags)]
  ['AGENTS.md.template', 'AGENTS.md', () => true],
  ['CLAUDE.md.template', 'CLAUDE.md', () => true],
  ['claude-local.md.template', 'CLAUDE.local.md', () => true],
  ['memory.md.template', 'memory.md', () => true],
  ['settings.json.template', '.claude/settings.json', () => true],
  ['agent-explorer.md.template', '.claude/agents/context-explorer.md', () => true],
  ['agent-reviewer.md.template', '.claude/agents/context-reviewer.md', () => true],
  ['docs-readme.md.template', 'docs/README.md', () => true],
  ['index.md.template', 'context/index.md', () => true],
  ['log.md.template', 'context/log.md', () => true],
  ['overview.md.template', 'context/overview.md', () => true],
  ['architecture.md.template', 'context/architecture.md', () => true],
  ['build-plan.template', 'context/build-plan.md', () => true],
  ['code-standards.md.template', 'context/code-standards.md', () => true],
  ['workflow-rules.md.template', 'context/workflow-rules.md', () => true],
  ['library-docs.md.template', 'context/library-docs.md', () => true],
  ['decisions.md.template', 'context/decisions.md', () => true],
  ['progress-tracker.md.template', 'context/progress-tracker.md', () => true],
  ['current-issues.md.template', 'context/current-issues.md', () => true],
  ['codebase-map.md.template', 'context/codebase/map.md', () => true],
  ['raw-README.md.template', 'context/raw/README.md', () => true],
  ['glossary.md.template', 'context/glossary.md', (d) => d.langs.some((l) => l !== 'docs')],
  ['testing.md.template', 'context/testing.md', (d) => d.langs.some((l) => l !== 'docs')],
  ['ui-tokens.md.template', 'context/ui-tokens.md', uiOn],
  ['ui-rules.md.template', 'context/ui-rules.md', uiOn],
  ['ui-registry.md.template', 'context/ui-registry.md', uiOn],
  ['data-model.md.template', 'context/data-model.md', (d, f) => fullOn(d, f) && d.signals.includes('db')],
  ['api-contracts.md.template', 'context/api-contracts.md', (d, f) => fullOn(d, f) && (d.signals.includes('backend') || d.signals.includes('ui'))],
  ['env-vars.md.template', 'context/env-vars.md', (d, f) => fullOn(d, f) && (d.signals.includes('backend') || d.signals.includes('ui') || d.signals.includes('data'))],
  ['integrations.md.template', 'context/integrations.md', (d, f) => fullOn(d, f) && (d.signals.includes('backend') || d.signals.includes('data') || d.signals.includes('db'))],
  ['runbook.md.template', 'context/runbook.md', (d, f) => fullOn(d, f) && (d.signals.includes('ui') || d.signals.includes('backend') || d.signals.includes('mobile') || d.signals.includes('data'))],
];
const POINTER_MAP = [
  ['GEMINI.md.template', 'GEMINI.md', 'gemini'],
  ['copilot-instructions.md.template', '.github/copilot-instructions.md', 'copilot'],
  ['cursor-rule.mdc.template', '.cursor/rules/project-context.mdc', 'cursor'],
];
/* ---- setup — the ONE command: everything mechanical, greenfield or brownfield.
   Idempotent (never clobbers filled content) and upgrade-safe (re-run after updating
   the skill: refreshes context/ctx.mjs, adds new files, bumps setupVersion). */
function mapDraft() {
  const mp = path.join(CTX, 'codebase', 'map.md');
  const filled = fs.existsSync(mp) && !/\{\{/.test(fs.readFileSync(mp, 'utf8'));
  if (filled) return { skipped: 'filled' };
  const files = sourceFiles();
  if (files.length < 3) return { skipped: 'small', files: files.length }; // greenfield: the template is the honest answer
  const byDir = new Map();
  for (const f of files) {
    const parts = f.split('/');
    const dir = parts.length > 1 ? parts.slice(0, Math.min(2, parts.length - 1)).join('/') + '/' : './ (root)';
    byDir.set(dir, (byDir.get(dir) || 0) + 1);
  }
  const entries = [];
  const pkg = readJsonSafe(path.join(ROOT, 'package.json'));
  if (pkg) {
    if (pkg.bin) for (const [k, v] of Object.entries(typeof pkg.bin === 'string' ? { [readJsonSafe(path.join(ROOT, 'package.json')).name]: pkg.bin } : pkg.bin)) entries.push(`\`${k}\` → \`${v}\` (bin)`);
    if (pkg.main) entries.push(`main: \`${pkg.main}\``);
    for (const [s, c] of Object.entries(pkg.scripts || {})) if (/^(dev|start|serve|build|test)/.test(s)) entries.push(`script \`npm run ${s}\`: \`${c}\``);
  }
  for (const cand of ['manage.py', 'main.py', 'app.py', 'src/main.rs', 'src/main.go', 'cmd/main.go', 'main.go', 'src/index.ts', 'src/index.js', 'src/main.ts']) if (fs.existsSync(path.join(ROOT, cand))) entries.push(`\`${cand}\``);
  const dirs = [...byDir.entries()].sort((a, b) => b[1] - a[1]);
  const topGlobs = dirs.slice(0, 8).map(([d]) => (d === './ (root)' ? '' : d + '**')).filter(Boolean);
  const md = `---
title: Codebase Map
type: module
status: draft
summary: Mechanical draft from ctx setup — directory census and entry points, no meaning yet
tags: [codebase,map]
covers: []
confidence: inferred
updated: ${today()}
---

# Codebase Map

## TL;DR

- Draft generated by \`ctx setup\` on ${today()} — **structure only, no meaning yet**. Verify each area by reading code (or \`ctx tools\` for a code-intel pass) before trusting it.
- ${files.length} source files across ${dirs.length} areas.

## Layout

| Area | Files | What lives here (fill from reading code) |
|---|---|---|
${dirs.map(([d, n]) => `| \`${d}\` | ${n} | TODO |`).join('\n')}

## Entry points

${entries.length ? entries.map((e) => `- ${e}`).join('\n') : '- TODO — no manifest entry points detected'}

## Where is X?

| Question | Answer (file → symbol) |
|---|---|

## Generated / do-not-edit

TODO — list code generators, migrations, vendored output. (\`ctx\` already ignores: ${CONFIG.ignoreDirs.slice(0, 8).join(', ')}.)

## Module pages

Create one per cohesive area as you learn it — \`ctx new module <name> --covers "<glob>"\`. Candidate globs from the census: ${topGlobs.slice(0, 6).map((g) => '`' + g + '`').join(', ') || '—'} (\`ctx coverage\` tracks the rest).
`;
  fs.mkdirSync(path.dirname(mp), { recursive: true });
  fs.writeFileSync(mp, md);
  return { skipped: false, files: files.length };
}
commands.setup = () => {
  if (path.resolve(SELF) !== path.resolve(path.join(ROOT, 'context', 'ctx.mjs')) && !fs.existsSync(path.join(SKILL_DIR, 'assets'))) {
    return die('setup must use the skill\'s own scripts/ctx.mjs (needs its assets/ folder) — run it from the project root: node <skill-dir>/scripts/ctx.mjs setup');
  }
  console.log('=== ctx setup ===\n');
  commands.init();
  const draft = mapDraft();
  if (!draft.skipped) console.log(`\nmap: drafted context/codebase/map.md from the code census (${draft.files} source files) — confidence: inferred`);
  else if (draft.skipped === 'small') console.log('\nmap: too little code to census (greenfield) — re-run setup once there is real code, or fill the template by hand');
  else console.log('\nmap: context/codebase/map.md already filled — left untouched');
  console.log('');
  commands.index();
  console.log('');
  commands.doctor();
  console.log(`
Judgement work left (the agent does this, the CLI cannot):
  1. fill every {{PLACEHOLDER}} from the planning conversation (ctx lint lists them)
  2. verify the map draft against real code; create module pages as areas get learned
  3. seed the task-routing table in context/index.md with this project's task types
Then: ctx task add "<first unit>" — and the system runs itself from there.`);
};

/* ---- rules — path-gated: what must be read for THESE files */
commands.rules = () => {
  if (!pos.length) return die('usage: ctx rules <file...>');
  const ruleFiles = [...walk(path.join(ROOT, '.claude', 'rules')), ...walk(path.join(ROOT, '.cursor', 'rules'))].filter((f) => f.endsWith('.md'));
  const rules = ruleFiles.map((f) => {
    const { data } = parseFrontmatter(fs.readFileSync(f, 'utf8'));
    return { file: rel(f), globs: asList(data.paths || data.globs).flatMap((g) => String(g).split(',').map((s) => s.trim()).filter(Boolean)), read: String(data.read || '').trim() };
  });
  const out = [];
  for (const raw of pos) {
    const f = raw.replace(/^\.\//, '');
    const matched = rules.filter((r) => r.globs.length && anyMatch(matchers(r.globs), f));
    const pages = [];
    for (const p of pages_()) {
      const rx = matchers(p.data.covers);
      if (rx.length && anyMatch(rx, f)) pages.push(p.rel);
    }
    const nested = [];
    for (const p of ['AGENTS.md', ...(() => {
      const parts = f.split('/');
      const acc = [];
      for (let i = 1; i < parts.length; i++) acc.push(parts.slice(0, i).join('/') + '/AGENTS.md');
      return acc;
    })()]) if (fs.existsSync(path.join(ROOT, p)) && p !== 'AGENTS.md') nested.push(p);
    out.push({ file: f, rules: matched.map((m) => m.file), pages, nestedAgents: nested });
  }
  emit({ command: 'rules', ok: true, matches: out }, () => {
    for (const m of out) {
      console.log(`${m.file}:`);
      for (const r of m.rules) {
        const rr = rules.find((x) => x.file === r);
        console.log(`  rule  ${r}${rr && rr.read ? ' — read ' + rr.read : ''}`);
      }
      for (const p of m.pages) console.log(`  page  ${p}`);
      for (const n of m.nestedAgents) console.log(`  local ${n} (danger zone — read before editing)`);
      if (!m.rules.length && !m.pages.length && !m.nestedAgents.length) console.log('  (nothing path-gated — orient via: ctx brief ' + m.file + ')');
    }
  });
};
function pages_() {
  return pages().filter((p) => !['superseded', 'archived'].includes(p.data.status));
}
commands.init = () => {
  const assetsDir = path.join(SKILL_DIR, 'assets');
  if (!fs.existsSync(assetsDir)) return die(`init needs the skill's assets/ folder — use the skill's own scripts/ctx.mjs from your project root (node <skill-dir>/scripts/ctx.mjs init); this copy at ${SELF} ships without it.`);
  const d = flags['no-detect'] ? { langs: [], kinds: ['generic'], signals: [], isMonorepo: false, tools: [], sourceExt: DEFAULTS.sourceExt, ignoreSourceGlobs: DEFAULTS.ignoreSourceGlobs } : detect(ROOT);
  const created = [];
  const skipped = [];
  const put = (asset, dest) => {
    const src = path.join(assetsDir, asset);
    const dst = path.join(ROOT, dest);
    if (!fs.existsSync(src)) {
      console.log(`! missing asset ${asset}`);
      return;
    }
    if (fs.existsSync(dst)) {
      skipped.push(dest);
      return;
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, fs.readFileSync(src, 'utf8').replace(/\{\{TODAY\}\}/g, today()));
    created.push(dest);
  };
  for (const [asset, dest, when] of INIT_MAP) if (when(d, flags)) put(asset, dest);
  if (flags.pointers) for (const [asset, dest] of POINTER_MAP) put(asset, dest);
  else for (const [asset, dest, tool] of POINTER_MAP) if (d.tools.includes(tool)) put(asset, dest);

  // config: seeded from the detected stack so coverage/impact speak this project's language
  const cfgPath = path.join(CTX, '.ctx.json');
  if (!fs.existsSync(cfgPath)) {
    fs.mkdirSync(CTX, { recursive: true });
    const cfg = {
      setupVersion: VERSION,
      profile: { langs: d.langs, kinds: d.kinds },
      maxPageLines: DEFAULTS.maxPageLines,
      maxAgentsLines: DEFAULTS.maxAgentsLines,
      maxSummaryChars: DEFAULTS.maxSummaryChars,
      alwaysRead: DEFAULTS.alwaysRead,
      sourceExt: d.sourceExt.length ? d.sourceExt : DEFAULTS.sourceExt,
      ignoreSourceGlobs: d.ignoreSourceGlobs.length ? d.ignoreSourceGlobs : DEFAULTS.ignoreSourceGlobs,
    };
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
    created.push('context/.ctx.json (seeded from detected profile)');
  } else {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.setupVersion !== VERSION) {
        cfg.setupVersion = VERSION;
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
        created.push('context/.ctx.json (setupVersion → ' + VERSION + ')');
      } else skipped.push('context/.ctx.json');
    } catch {
      skipped.push('context/.ctx.json (unparseable — fix by hand)');
    }
  }

  // path-gated rules: thin pointers — content stays in the wiki, the rule just loads it at the right moment
  const RULES = [];
  if (uiOn(d, flags)) RULES.push(['frontend.md', ['src/components/**', 'src/app/**', 'app/**', 'components/**', '**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte'], 'context/ui-rules.md → context/ui-tokens.md → context/ui-registry.md']);
  if (d.signals.includes('backend')) RULES.push(['api.md', ['src/api/**', 'src/routes/**', 'src/server/**', 'api/**', 'routes/**', 'routers/**', 'src/handlers/**'], 'context/api-contracts.md → context/code-standards.md']);
  if (d.signals.includes('db')) RULES.push(['data.md', ['**/schema.ts', '**/schema.py', 'prisma/**', 'drizzle/**', '**/models/**', '**/migrations/**', '**/*.sql'], 'context/data-model.md → grep context/decisions.md for the area']);
  if (d.langs.some((l) => l !== 'docs')) RULES.push(['testing.md', ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', 'tests/**', 'test/**', '**/*_test.go'], 'context/testing.md']);
  for (const [name, globs, read] of RULES) {
    const dst = path.join(ROOT, '.claude', 'rules', name);
    if (fs.existsSync(dst)) {
      skipped.push('.claude/rules/' + name);
      continue;
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(
      dst,
      fs
        .readFileSync(path.join(assetsDir, 'rule.md.template'), 'utf8')
        .replace(/\{\{TODAY\}\}/g, today())
        .replace(/\{\{NAME\}\}/g, name.replace(/\.md$/, ''))
        .replace(/\{\{GLOBS\}\}/g, globs.join(', '))
        .replace(/\{\{READ\}\}/g, read)
    );
    created.push('.claude/rules/' + name + ' (path-gated)');
  }

  // subagent memory: each agent owns a MEMORY.md it reads first and appends lessons to
  for (const agent of ['context-explorer', 'context-reviewer']) {
    const dst = path.join(CTX, 'agents', agent, 'MEMORY.md');
    if (fs.existsSync(dst)) {
      skipped.push('context/agents/' + agent + '/MEMORY.md');
      continue;
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, fs.readFileSync(path.join(assetsDir, 'agent-memory.md.template'), 'utf8').replace(/\{\{TODAY\}\}/g, today()).replace(/\{\{AGENT\}\}/g, agent));
    created.push('context/agents/' + agent + '/MEMORY.md');
  }

  // danger zones: nested AGENTS.md where the landmines are (auth, payments, migrations…)
  if (flags.danger && flags.danger !== true) {
    for (const zone of String(flags.danger).split(',').map((s) => s.trim()).filter(Boolean)) {
      const abs = path.join(ROOT, zone);
      if (!fs.existsSync(abs)) {
        console.log(`! danger zone ${zone} does not exist — skipped`);
        continue;
      }
      const dst = path.join(abs, 'AGENTS.md');
      if (fs.existsSync(dst)) {
        skipped.push(zone + '/AGENTS.md');
        continue;
      }
      fs.writeFileSync(dst, fs.readFileSync(path.join(assetsDir, 'nested-AGENTS.md.template'), 'utf8').replace(/\{\{packages\/storefront\/\}\}/g, zone + '/'));
      created.push(zone + '/AGENTS.md (danger zone)');
    }
  }

  for (const dir of ['context/feature-specs', 'context/codebase/modules', 'context/designs', 'context/screenshots', 'context/sources', 'context/archive', 'docs/adr', 'docs/runbooks']) {
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
    const keep = path.join(ROOT, dir, '.gitkeep');
    if (!fs.existsSync(keep) && !fs.readdirSync(path.join(ROOT, dir)).length) fs.writeFileSync(keep, '');
  }
  const self = path.join(ROOT, 'context', 'ctx.mjs');
  if (path.resolve(self) !== path.resolve(SELF)) {
    const srcBuf = fs.readFileSync(SELF);
    if (!fs.existsSync(self) || !fs.readFileSync(self).equals(srcBuf)) {
      fs.writeFileSync(self, srcBuf);
      created.push('context/ctx.mjs (refreshed to skill version ' + VERSION + ')');
    } else skipped.push('context/ctx.mjs');
  }
  const gi = path.join(ROOT, '.gitignore');
  const add = fs.readFileSync(path.join(assetsDir, 'gitignore.append'), 'utf8');
  const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  const have = new Set(cur.split('\n').map((l) => l.trim()));
  const newLines = add.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !have.has(l.trim()));
  if (newLines.length) {
    fs.appendFileSync(gi, (cur && !cur.endsWith('\n') ? '\n' : '') + '\n# project-context-system\n' + newLines.join('\n') + '\n');
    created.push('.gitignore (merged)');
  }
  console.log(`profile: ${d.langs.join(', ') || '?'} · kinds: ${d.kinds.join(', ') || 'generic'} · signals: ${d.signals.join(', ') || '—'}${flags['no-detect'] ? ' (detection skipped)' : ''}`);
  console.log(`created (${created.length}):\n  ${created.join('\n  ')}`);
  if (skipped.length) console.log(`kept existing (${skipped.length}): ${skipped.join(', ')}`);
  const delegated = INTEL_TOOLS.filter((t) => {
    try {
      return t.probe();
    } catch {
      return false;
    }
  }).map((t) => t.id);
  if (delegated.length) console.log(`\ndelegation available (ctx tools): ${delegated.join(', ')} — prefer them for the code map; see references/tool-delegation.md`);
  console.log(`\nNext: fill every {{PLACEHOLDER}} from the planning conversation (never from guesses), then:\n  node context/ctx.mjs index && node context/ctx.mjs lint && node context/ctx.mjs doctor`);
};

/* ----------------------------------------------------------------- main */
function die(msg) {
  console.error(msg);
  process.exit(1);
}
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '--version' || !commands[cmd]) {
  if (cmd === '--version') {
    console.log(`ctx ${VERSION}`);
    process.exit(0);
  }
  const doc = fs.readFileSync(SELF, 'utf8').split('*/')[0].replace(/^[\s\S]*?\/\*\*/, '').replace(/^ \* ?/gm, '');
  console.log(doc.trim());
  process.exit(cmd && cmd !== 'help' && cmd !== '--help' ? 1 : 0);
}
commands[cmd]();
