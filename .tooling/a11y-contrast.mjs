// Rendered-pixel contrast audit.
// axe cannot resolve contrast over pseudo-element textures or gradients, so this
// harness screenshots the real page, samples the pixels inside each text
// element's box, and compares the dominant background colour with the computed
// text colour. Usage: node .tooling/a11y-contrast.mjs
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.A11Y_BASE ?? 'http://127.0.0.1:5178';
const CDP = process.env.A11Y_CDP ?? 'http://127.0.0.1:9222';
const THEMES = ['web', 'tree', 'mycelium'];
const ROUTES = [
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

const target = await (
  await fetch(`${CDP}/json/new?${encodeURIComponent(BASE + '/#/home')}`, { method: 'PUT' })
).json();
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
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
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
await send('Page.bringToFront');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await waitFor(`!!document.querySelector('.app-shell')`);

const setTheme = async (theme) => {
  await evaluate(`(() => {
    const parsed = JSON.parse(localStorage.getItem('understory.node.v1'));
    parsed.settings.theme = ${JSON.stringify(theme)};
    localStorage.setItem('understory.node.v1', JSON.stringify(parsed));
  })()`);
  PAGE_URL = `${BASE}/?contrast=${Date.now()}`;
  await send('Page.navigate', { url: PAGE_URL + '#/home' });
  await waitFor(`!!document.querySelector('.app-shell')`);
  await sleep(1200);
  return evaluate(`document.documentElement.dataset.theme`);
};

const sampler = fs.readFileSync(path.join(import.meta.dirname, 'a11y-contrast-sampler.js'), 'utf8');

const nodalId = await evaluate(`(() => { try { const d = JSON.parse(localStorage.getItem('understory.node.v1')).data; return d.places?.find((p) => p.nodal)?.id; } catch { return null; } })()`);
if (nodalId) ROUTES.push('nodal-locations/' + nodalId);

const findings = [];
let totalBoxes = 0;
let auditedPages = 0;
let PAGE_URL = BASE + '/'; // constant query keeps hash navigation in-document
for (const theme of THEMES) {
  const applied = await setTheme(theme);
  if (applied !== theme) console.log(`! theme ${theme} applied as ${applied}`);
  await evaluate(sampler); // the theme switch performed a full reload
  for (const route of ROUTES) {
    await send('Page.navigate', { url: `${PAGE_URL}#/${route}` });
    await waitFor(`location.hash === '#/${route}' && !!document.querySelector('main#main')`);
    await sleep(900);
    await send('Page.bringToFront');
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    const rows = await evaluate(
      `window.__contrastSample(${JSON.stringify(shot.result.data)}, 1)`,
    );
    auditedPages += 1;
    totalBoxes += rows.length;
    for (const row of rows) {
      if (!row.pass) findings.push({ theme, route, ...row });
    }
    process.stdout.write(
      `${theme}/${route}: ${rows.length} text boxes, ${rows.filter((r) => !r.pass).length} below threshold\n`,
    );
  }
}

fs.writeFileSync(
  path.join(import.meta.dirname, 'a11y-contrast-results.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), auditedPages, textBoxes: totalBoxes, failures: findings }, null, 2),
);
console.log('\n=== rendered contrast failures ===');
const grouped = new Map();
for (const f of findings) {
  const key = `${f.theme} ${f.fg} on ${f.bg} ${f.ratio}:1 (${f.fontSize}px/${f.weight}) ${f.selector}`;
  grouped.set(key, (grouped.get(key) ?? 0) + 1);
}
for (const [key, count] of [...grouped].sort()) console.log(`${count}x ${key}`);
console.log(`\n${findings.length} failing text boxes`);
ws.close();
await fetch(`${CDP}/json/close/${target.id}`);
