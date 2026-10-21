// Accessibility audit harness: runs axe-core over every route and theme.
// Usage: node .tooling/a11y-audit.mjs
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.A11Y_BASE ?? 'http://127.0.0.1:5178';
const CDP = process.env.A11Y_CDP ?? 'http://127.0.0.1:9222';
const AXE = fs.readFileSync(path.join(import.meta.dirname, 'axe.min.js'), 'utf8');

const THEMES = ['web', 'tree', 'mycelium'];
const MAIN_ROUTES = [
  'home',
  'network',
  'communities',
  'gatherings',
  'projects',
  'knowledge',
  'places',
  'nodal-locations',
  'settings',
  'appearance',
  'about',
];
const MOBILE_ROUTES = ['home', 'network', 'nodal-locations', 'appearance', 'knowledge'];

const target = await (await fetch(`${CDP}/json/new?${encodeURIComponent(BASE + '/#/home')}`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression, awaitPromise = true) => {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });
  if (res.result?.exceptionDetails) {
    throw new Error(res.result.exceptionDetails.exception?.description ?? 'evaluate failed');
  }
  return res.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expression, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await evaluate(expression)) return true;
    } catch {}
    await sleep(120);
  }
  return false;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await waitFor(`!!document.querySelector('.app-shell')`);

const ids = await evaluate(`(() => {
  try {
    const raw = localStorage.getItem('understory.node.v1');
    const parsed = JSON.parse(raw);
    const d = parsed.data;
    return {
      community: d.communities?.[0]?.id,
      gathering: d.gatherings?.[0]?.id,
      project: d.projects?.[0]?.id,
      knowledge: d.knowledge?.[0]?.id,
      location: d.places?.find((p) => p.nodal)?.id,
    };
  } catch { return {}; }
})()`);

const DETAIL_ROUTES = [
  ids.community && `communities/${ids.community}`,
  ids.gathering && `gatherings/${ids.gathering}`,
  ids.project && `projects/${ids.project}`,
  ids.knowledge && `knowledge/${ids.knowledge}`,
  ids.location && `nodal-locations/${ids.location}`,
].filter(Boolean);

const setTheme = async (theme) => {
  await evaluate(`(() => {
    const key = 'understory.node.v1';
    const parsed = JSON.parse(localStorage.getItem(key));
    if (parsed?.settings?.theme !== ${JSON.stringify(theme)}) {
      parsed.settings.theme = ${JSON.stringify(theme)};
      localStorage.setItem(key, JSON.stringify(parsed));
    }
  })()`);
  // A full document load is required: the in-memory store would otherwise
  // persist its previous theme back over the stored one.
  await send('Page.navigate', { url: `${BASE}/?a11y=${Date.now()}#/home` });
  await waitFor(`!!document.querySelector('.app-shell')`);
  await sleep(400);
  return evaluate(`document.documentElement.dataset.theme`);
};

const runAxe = async () => {
  await evaluate(AXE + ';true');
  return evaluate(`(async () => {
    const result = await axe.run(document, {
      resultTypes: ['violations', 'incomplete'],
      elementRef: false,
      ancestry: false,
    });
    const clean = (list, kind) => list.map((v) => ({
      kind,
      id: v.id,
      impact: v.impact,
      help: v.help,
      tags: v.tags,
      nodes: v.nodes.map((n) => ({
        target: n.target.join(' '),
        html: (n.html ?? '').slice(0, 220),
        summary: (n.failureSummary ?? '').slice(0, 400),
      })),
    }));
    return {
      violations: clean(result.violations, 'violation'),
      incomplete: clean(result.incomplete, 'incomplete'),
      passes: result.passes.length,
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      theme: document.documentElement.dataset.theme,
    };
  })()`);
};

const results = [];
const audit = async (route, theme, viewport) => {
  // A unique query means every audit is a fresh document load at the target
  // route. Routes are code-split, and an in-app hash change would let axe run
  // against the previous view or the loading fallback; this keeps the unit of
  // measurement unambiguous. In-app navigation is probed by a11y-probe2.mjs.
  const url = `${BASE}/?a11y=${Date.now()}#/${route}`;
  const label = `${viewport.name} ${theme} /${route}`;
  try {
    await send('Page.navigate', { url });
    const rendered = await waitFor(`(() => {
      if (location.hash !== '#/${route}') return false;
      if (document.querySelector('.page-loading')) return false;
      return Boolean(document.querySelector('main#main h1'));
    })()`, 15000);
    if (!rendered) throw new Error('the view did not render within 15s');
    await sleep(450);
    const res = await runAxe();
    results.push({ label, route, theme, viewport: viewport.name, ...res });
    const v = res.violations.length;
    const i = res.incomplete.length;
    process.stdout.write(`${v === 0 ? 'ok  ' : 'FAIL'} ${label} · violations=${v} incomplete=${i}\n`);
  } catch (error) {
    process.stdout.write(`ERR  ${label} · ${error.message}\n`);
    results.push({ label, route, theme, viewport: viewport.name, error: error.message });
  }
};

for (const theme of THEMES) {
  const applied = await setTheme(theme);
  if (applied !== theme) process.stdout.write(`! theme ${theme} applied as ${applied}\n`);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const route of [...MAIN_ROUTES, ...DETAIL_ROUTES]) {
    await audit(route, theme, { name: 'desktop' });
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  for (const route of MOBILE_ROUTES) {
    await audit(route, theme, { name: 'mobile' });
  }
}

fs.writeFileSync(
  path.join(import.meta.dirname, 'a11y-results.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, detailRoutes: DETAIL_ROUTES, results }, null, 2),
);

// summary
const byRule = new Map();
for (const r of results) {
  for (const v of r.violations ?? []) {
    const key = `${v.id}|${v.impact}`;
    const entry = byRule.get(key) ?? { id: v.id, impact: v.impact, help: v.help, tags: v.tags, count: 0, pages: new Set(), samples: [] };
    entry.count += 1;
    entry.pages.add(`${r.theme}/${r.route}/${r.viewport}`);
    if (entry.samples.length < 3 && v.nodes[0]) entry.samples.push(v.nodes[0].target);
    byRule.set(key, entry);
  }
}
const summary = [...byRule.values()]
  .sort((a, b) => b.count - a.count)
  .map((e) => ({ ...e, pages: [...e.pages].slice(0, 6), pageCount: e.pages.size }));
fs.writeFileSync(path.join(import.meta.dirname, 'a11y-summary.json'), JSON.stringify(summary, null, 2));
console.log('\n=== violations by rule ===');
for (const e of summary) {
  console.log(`${e.count}x [${e.impact}] ${e.id} — ${e.help}`);
  console.log(`   tags: ${e.tags.join(', ')}`);
  console.log(`   e.g. ${e.samples.join(' | ')}`);
  console.log(`   on ${e.pageCount} page/theme combos`);
}
const errors = results.filter((r) => r.error).length;
const violations = results.reduce((n, r) => n + (r.violations?.length ?? 0), 0);
console.log(`\n${results.length} page audits · ${violations} violating rules total · ${errors} failed to render`);
if (violations > 0 || errors > 0) process.exitCode = 1;
ws.close();
const closeTarget = await fetch(`${CDP}/json/close/${target.id}`);
console.log('closed target', closeTarget.status);
