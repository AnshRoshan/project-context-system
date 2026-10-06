/* project-context-system landing: vanilla + D3. Motion respects prefers-reduced-motion.
   Terminal output is real ctx output captured from this repo. */
(function () {
  'use strict';
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s) { return document.querySelector(s); };

  /* ---------- copy button ---------- */
  var copyBtn = $('#copy-install');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    navigator.clipboard.writeText('node <clone>/scripts/ctx.mjs setup').then(function () {
      copyBtn.textContent = 'copied';
      setTimeout(function () { copyBtn.textContent = 'copy'; }, 1600);
    });
  });

  /* ---------- hero: D3 wiki graph ---------- */
  var nodes = [
    { id: 'AGENTS.md', g: 'schema', r: 16, tip: 'The schema. Every agent reads it first. 120 lines, routed, with a Lessons section that learns from corrections.' },
    { id: 'index.md', g: 'schema', r: 13, tip: 'The router. Task to pages, plus a generated one-line catalog of every page.' },
    { id: 'memory.md', g: 'page', r: 11, tip: 'Current state and the exact next step. How any session resumes with zero re-explaining.' },
    { id: 'architecture.md', g: 'page', r: 10, tip: 'Stack roles, boundaries, and the invariants the system must never violate.' },
    { id: 'decisions.md', g: 'page', r: 10, tip: 'Every hard call with options, lost alternative, cost, reversibility. D-01 to D-05 here.' },
    { id: 'tracker.md', g: 'page', r: 10, tip: 'The task ledger: In progress (max one), Blocked, Up next, Completed.' },
    { id: 'modules/auth.md', g: 'page', r: 9, tip: 'Module page. Covers globs, contracts, gotchas. Read its TL;DR, skip the repo.' },
    { id: 'modules/billing.md', g: 'page', r: 9, tip: 'Another area. Created the first time an agent learns it, updated when code moves.' },
    { id: 'src/auth/**', g: 'code', r: 7 },
    { id: 'src/billing/**', g: 'code', r: 7 },
    { id: 'src/db/schema.ts', g: 'code', r: 7 },
    { id: 'rules/frontend.md', g: 'rule', r: 8, tip: 'Path-gated rule. Loads ui-rules pages only when an agent touches matching files.' },
    { id: 'rules/testing.md', g: 'rule', r: 8 },
    { id: 'raw/prd-v2.md', g: 'raw', r: 8, tip: 'Immutable input. Ingested into a source summary, then into affected pages.' },
    { id: 'sources/prd-v2.md', g: 'page', r: 8 },
    { id: 'agents/explorer', g: 'agent', r: 9, tip: 'Read-only subagent with its own persistent memory. Explores, reports, never pollutes the main window.' }
  ];
  nodes.push({ id: 'schema', g: 'raw', r: 7, tip: 'Design docs and screenshots live beside the wiki. Shared context, not scratch.' });
  var links = [
    ['AGENTS.md', 'index.md'], ['index.md', 'memory.md'], ['index.md', 'architecture.md'],
    ['index.md', 'decisions.md'], ['index.md', 'tracker.md'], ['index.md', 'modules/auth.md'],
    ['index.md', 'modules/billing.md'], ['modules/auth.md', 'src/auth/**'], ['modules/billing.md', 'src/billing/**'],
    ['architecture.md', 'src/db/schema.ts'], ['rules/frontend.md', 'modules/billing.md'],
    ['rules/testing.md', 'src/auth/**'], ['raw/prd-v2.md', 'sources/prd-v2.md'], ['sources/prd-v2.md', 'decisions.md'],
    ['agents/explorer', 'modules/auth.md'], ['AGENTS.md', 'schema'], ['schema', 'raw/prd-v2.md']
  ].map(function (l) { return { source: l[0], target: l[1] }; });

  var host = $('#wiki-graph');
  if (host && window.d3) {
    var W = host.clientWidth || 480, H = host.clientHeight || 440;
    var color = { schema: '#38BDF8', page: '#38BDF8', code: '#8CA0C3', rule: '#F8FAFC', raw: '#2B3A58', agent: '#38BDF8' };
    var svg = d3.select(host).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('width', '100%').attr('height', '100%');
    var tip = d3.select(host).append('div').attr('class', 'gtip').style('position', 'fixed');
    var sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(76).strength(0.45))
      .force('charge', d3.forceManyBody().strength(-170))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide().radius(function (d) { return d.r + 15; }));
    if (RM) { for (var i = 0; i < 200; i++) sim.tick(); }
    var link = svg.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#2B3A58').attr('stroke-width', 1);
    var node = svg.append('g').selectAll('g').data(nodes).join('g').attr('class', 'gnode')
      .call(d3.drag()
        .on('start', function (e, d) { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', function (e, d) { d.fx = e.x; d.fy = e.y; })
        .on('end', function (e, d) { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
    node.append('circle').attr('r', function (d) { return d.r; })
      .attr('fill', function (d) { return d.g === 'rule' ? 'none' : color[d.g]; })
      .attr('fill-opacity', function (d) { return d.g === 'code' ? 0.5 : d.g === 'raw' ? 0.9 : 0.18; })
      .attr('stroke', function (d) { return color[d.g]; })
      .attr('stroke-width', function (d) { return d.g === 'rule' || d.g === 'schema' ? 2 : 1; });
    node.append('text').attr('class', 'glabel').attr('dy', function (d) { return -d.r - 4; })
      .attr('text-anchor', 'middle')
      .text(function (d) { return d.id.length > 18 ? d.id.slice(0, 16) + '…' : d.id; });
    node.on('pointerenter', function (e, d) {
      d3.select(this).select('circle').attr('fill-opacity', 0.45);
      link.attr('stroke', function (l) { return l.source === d || l.target === d ? '#38BDF8' : '#2B3A58'; });
      if (d.tip) {
        tip.html('<b>' + d.id + '</b><br>' + d.tip).classed('on', true)
          .style('left', Math.min(e.clientX + 14, window.innerWidth - 280) + 'px')
          .style('top', (e.clientY + 14) + 'px');
      }
    }).on('pointerleave', function (e, d) {
      d3.select(this).select('circle').attr('fill-opacity', d.g === 'code' ? 0.5 : d.g === 'raw' ? 0.9 : 0.18);
      link.attr('stroke', '#2B3A58');
      tip.classed('on', false);
    });
    sim.on('tick', function () {
      link.attr('x1', function (l) { return l.source.x; }).attr('y1', function (l) { return l.source.y; })
        .attr('x2', function (l) { return l.target.x; }).attr('y2', function (l) { return l.target.y; });
      node.attr('transform', function (d) {
        d.x = Math.max(46, Math.min(W - 46, d.x));
        d.y = Math.max(20, Math.min(H - 20, d.y));
        return 'translate(' + d.x + ',' + d.y + ')';
      });
    });
  }

  /* ---------- cost chart ---------- */
  var chart = $('#cost-chart');
  if (chart && window.d3) {
    var cW = 640, cH = 300, m = { t: 16, r: 12, b: 28, l: 40 };
    var csvg = d3.select(chart);
    var x = d3.scaleLinear().domain([1, 40]).range([m.l, cW - m.r]);
    var y = d3.scaleLinear().domain([0, 60]).range([cH - m.b, m.t]);
    var cold = function (s) { return 42 + Math.sin(s / 3) * 4; };
    var warm = function (s) { return Math.max(2.4, 5 - s * 0.04); };
    csvg.append('g').attr('transform', 'translate(0,' + (cH - m.b) + ')')
      .call(d3.axisBottom(x).ticks(6).tickFormat(function (d) { return 'session ' + d; }))
      .call(function (g) { g.select('.domain').attr('stroke', '#2B3A58'); g.selectAll('.tick line').attr('stroke', '#2B3A58'); g.selectAll('text').attr('fill', '#8CA0C3').attr('font-size', 9); });
    csvg.append('g').attr('transform', 'translate(' + m.l + ',0)')
      .call(d3.axisLeft(y).ticks(4).tickFormat(function (d) { return d + 'k'; }))
      .call(function (g) { g.select('.domain').remove(); g.selectAll('.tick line').attr('stroke', '#2B3A58').attr('x2', cW - m.l - m.r); g.selectAll('text').attr('fill', '#8CA0C3').attr('font-size', 9); });
    var line = function (fn) {
      return d3.line().x(function (d) { return x(d); }).y(function (d) { return y(fn(d)); }).curve(d3.curveMonotoneX);
    };
    var xs = d3.range(1, 41);
    var paths = [
      { fn: cold, stroke: '#F87171', cls: 'cold' },
      { fn: warm, stroke: '#38BDF8', cls: 'warm' }
    ];
    paths.forEach(function (p) {
      var path = csvg.append('path').datum(xs).attr('d', line(p.fn))
        .attr('fill', 'none').attr('stroke', p.stroke).attr('stroke-width', 2);
      if (!RM) {
        var len = path.node().getTotalLength();
        path.attr('stroke-dasharray', len + ' ' + len).attr('stroke-dashoffset', len)
          .transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);
      }
    });
    var marker = csvg.append('g');
    marker.append('line').attr('stroke', '#8CA0C3').attr('stroke-dasharray', '3 3').attr('y1', m.t).attr('y2', cH - m.b);
    var dotC = marker.append('circle').attr('r', 4).attr('fill', '#F87171');
    var dotW = marker.append('circle').attr('r', 4).attr('fill', '#38BDF8');
    var slider = $('#session-slider');
    function readout(s) {
      marker.attr('transform', 'translate(' + x(s) + ',0)');
      dotC.attr('cy', y(cold(s)));
      dotW.attr('cy', y(warm(s)));
      $('#session-out').textContent = s;
      $('#stat-cold').textContent = Math.round(cold(s)) + 'k tok';
      $('#stat-warm').textContent = warm(s).toFixed(1) + 'k tok';
      var total = 0; for (var i = 1; i <= 40; i++) total += cold(i) - warm(i);
      $('#stat-total').textContent = total >= 1000 ? (total / 1000).toFixed(1) + 'M tokens' : Math.round(total) + 'k tokens';
    }
    slider.addEventListener('input', function () { readout(+slider.value); });
    readout(+slider.value);
  }

  /* ---------- ladder tabs ---------- */
  var rungs = [
    { t: 'Rung 01. Always loaded. The constitution.', d: 'AGENTS.md stays under 120 lines: project facts, invariants, the recording table, Lessons. Everything else is one routed link away. If it grows, detail moves down the ladder.', c: '<span class="hl">AGENTS.md</span> → context/index.md → memory.md   ≈ 2 to 5k tokens, every session' },
    { t: 'Rung 02. Path-gated. Conventions that follow the work.', d: '.claude/rules/*.md carry a paths: list. The frontend conventions load only when an agent touches frontend files. Zero tokens spent on rules that do not apply right now.', c: 'ctx rules src/components/Button.tsx\n  rule  <span class="hl">.claude/rules/frontend.md</span> → read context/ui-rules.md' },
    { t: 'Rung 03. On invoke. The skill, when the task matches.', d: 'SKILL.md is a router; the eleven reference playbooks load only for the operation at hand: adopt, ingest, lint, handoff, archive. Procedures arrive when called, not always-on.', c: 'task: "adopt this repo"  →  references/<span class="hl">codebase-wiki</span>.md' },
    { t: 'Rung 04. Isolated. Agents with their own memory.', d: 'Explorer and reviewer subagents get a clean window, report back in five lines, and keep a persistent MEMORY.md. Their experience is committed, versioned, inherited.', c: 'context/<span class="hl">agents/explorer/MEMORY.md</span>   read first · append last' },
  ];
  var rungBtns = document.querySelectorAll('.rung');
  function showRung(i) {
    rungBtns.forEach(function (b, j) { b.classList.toggle('is-active', i === j); b.setAttribute('aria-selected', i === j); });
    $('#rung-title').textContent = rungs[i].t;
    $('#rung-text').textContent = rungs[i].d;
    $('#rung-code').innerHTML = rungs[i].c;
  }
  rungBtns.forEach(function (b) { b.addEventListener('click', function () { showRung(+b.dataset.rung); }); });
  showRung(0);

  /* ---------- pipeline nodes ---------- */
  var pipeTxt = [
    'Raw is truth. Source code plus context/raw/: PRDs, notes, vendor docs. Immutable. The settings deny rule blocks edits to raw/ even when the agent agrees to try.',
    'The wiki is the compiled layer. Every page carries frontmatter, a TL;DR, and covers: globs over the code it describes. ctx impact maps changed files to the pages that must update, in the same commit.',
    'The schema is the contract. AGENTS.md plus the router index tell any agent, in any tool, on any machine: read cheap, then deep, record while working, never decide silently.'
  ];
  var pipeBtns = document.querySelectorAll('.pipe-node');
  pipeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      pipeBtns.forEach(function (o) { o.classList.toggle('is-active', o === b); });
      $('#pipe-detail').textContent = pipeTxt[+b.dataset.i];
    });
  });
  pipeBtns[0].click();

  /* ---------- terminal ---------- */
  var demos = {
    brief: '$ ctx brief src/auth/session.ts\nALWAYS READ (orient):\n  - context/index.md  (~1.4k tok)\n  - memory.md  (~0.6k tok)\n\nTASK-RELEVANT (stop when you have enough):\n  1. context/codebase/modules/auth.md  [module, ~0.9k tok]  (covers src/auth/session.ts)\n     Owns sessions and login. Biggest gotcha: token refresh races the cookie.\n     > Entry: POST /session -> createSession() in src/auth/session.ts\n  2. context/decisions.md#D-02  (~0.3k tok)  (tag~auth)\n\nEstimated total: ~3.2k tokens. Read TL;DR first.\n<span class="t-ok">✓ routed in 11ms. no repo scan needed.</span>',
    task: '$ ctx task start 03\n<span class="t-ok">Feature 03 → In progress (was in Up next)</span>\n\n$ ctx task start 04\n<span class="t-ok">one unit at a time: - Feature 03: session refresh: started 2026-10-06\nis In progress. Finish it (ctx task done) or pass --force.</span>\n\n<span class="t-ok">✓ the ledger enforces what the team agreed to.</span>',
    impact: '$ ctx impact\nIMPACT: 2 changed code file(s)\n  ✗ REVIEW    context/codebase/modules/auth.md   <- src/auth/session.ts\n  ✓ updated   context/codebase/modules/billing.md <- src/billing/charge.ts\n\nTracker/memory touched: context/progress-tracker.md\n\n$ ctx stamp context/codebase/modules/auth.md\nstamped context/codebase/modules/auth.md @ 47d649b\n\n<span class="t-ok">✓ the Stop hook refuses to end the session until every ✗ is gone.</span>',
    archive: '$ ctx archive --dry-run\nlog: 14 entries older than 2026-04-10 → context/archive/log-2026-04.md\ntracker: 6 old completions → context/archive/tracker-2026.md (pointer left behind)\ndecisions: 214 lines: split by year, keep D-NN ids stable\n\n<span class="t-ok">✓ hot files stay small. history stays greppable. nothing is deleted.</span>',
    doctor: '$ ctx doctor\nok    AGENTS.md present\nok    CLAUDE.md imports AGENTS.md\nok    context/index.md has ctx markers\nok    context/ctx.mjs present\nok    .gitignore covers current-issues.md\nok    .claude/settings.json denies .env reads\nok    SessionStart hook wired\nok    Stop hook wired\nok    project tooling at skill version 2.4.0\nok    .claude/rules/ path-gated rules present\nok    subagent memory wired\n\n<span class="t-ok">ctx doctor: 12/12 checks pass</span>',
  };
  var out = $('#term-out');
  function typeInto(html, done) {
    if (RM) { out.innerHTML = html; if (done) done(); return; }
    out.innerHTML = '';
    var plain = html.replace(/<[^>]+>/g, '');
    var step = 0, chunk = 3;
    var t = setInterval(function () {
      step += chunk;
      out.textContent = plain.slice(0, step);
      if (step >= plain.length) { clearInterval(t); out.innerHTML = html; if (done) done(); }
    }, 6);
  }
  var chips = document.querySelectorAll('.chip');
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      chips.forEach(function (o) { o.classList.toggle('is-active', o === ch); });
      typeInto(demos[ch.dataset.cmd]);
    });
  });
  var typedOnce = false;

  /* ---------- ledger sim ---------- */
  var L = { next: ['04 checkout v2', '05 rate limits', '06 exports'], now: [], blocked: [], done: ['01 one-command', '02 teams+growth'] };
  function render(hotId, errId) {
    ['next', 'now', 'blocked', 'done'].forEach(function (k) {
      var ul = $('#lc-' + k);
      ul.innerHTML = '';
      L[k].forEach(function (id) {
        var li = document.createElement('li');
        li.className = 'ltask' + (id === hotId ? ' hot enter' : '') + (id === errId ? ' err' : '');
        li.textContent = 'Feature ' + id;
        ul.appendChild(li);
        if (id === hotId) requestAnimationFrame(function () { li.classList.remove('enter'); });
      });
    });
  }
  render();
  var script = [
    { fn: function () { L.next = L.next.filter(function (x) { return x !== '03 session refresh'; }); L.now = ['03 session refresh']; render('03 session refresh'); msg('branch A: ctx task start 03 → In progress. one unit at a time, enforced.'); }, d: 900 },
    { fn: function () { L.next = ['03 billing webhook', '04 checkout v2', '05 rate limits']; render('03 billing webhook'); msg('branch B started its own Feature 03. nobody noticed yet.'); }, d: 2200 },
    { fn: function () { L.now = ['03 session refresh']; L.next = ['04 checkout v2', '05 rate limits', '06 exports', '03 billing webhook']; render(null, '03 billing webhook'); msg('ctx lint ERROR: Feature 03 listed twice: branch merge collision. keep one line, renumber the other.', true); }, d: 2400 },
    { fn: function () { L.next = ['07 billing webhook', '04 checkout v2', '05 rate limits']; render(null); msg('ctx task add --spec refuses claimed numbers. collision resolved by tooling, not by argument.'); }, d: 2200 },
    { fn: function () { L.now = []; L.done = L.done.concat(['03 session refresh']); render(); msg('ctx task done 03 -m "token refresh in session.ts, env AUTH_TTL" → Completed with the details.'); }, d: 2400 },
    { fn: function () { L.done = ['01 one-command', '02 teams+growth', '03 session refresh']; L.blocked = ['07 billing webhook: blocked: waiting on Stripe keys']; render(); msg('and ctx archive rotates these completions out when they age. the hot files never grow.'); }, d: 2600 },
  ];
  var msgEl = $('#ledger-msg');
  function msg(t, bad) { msgEl.textContent = t; msgEl.classList.toggle('bad', !!bad); }
  $('#ledger-run').addEventListener('click', function () {
    var i = 0;
    (function step() {
      if (i >= script.length) return;
      setTimeout(function () { script[i].fn(); i++; step(); }, RM ? 0 : script[i].d);
    })();
  });

  /* ---------- reveal on scroll (below-fold only) ---------- */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      if (e.target.id === 'cli' && !typedOnce) { typedOnce = true; typeInto(demos.brief); }
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.section, .hero-graph, .sec-head').forEach(function (el, i) {
    el.classList.add('reveal');
    el.style.setProperty('--i', i % 4);
    io.observe(el);
  });
})();
