// Post-fix interaction verification.
import fs from 'node:fs';

const CDP = 'http://127.0.0.1:9222';
const BASE = 'http://127.0.0.1:5178';
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
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description);
  return res.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (k, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
  await sleep(120);
};
const tab = () => key('Tab', 'Tab', 9);

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await sleep(1500);

const out = {};

// Titles
out.titles = {};
for (const route of ['home', 'network', 'settings', 'appearance', 'nodal-locations']) {
  await evaluate(`location.hash = '#/${route}'`);
  await sleep(300);
  out.titles[route] = await evaluate(`document.title`);
}

// Skip link from a non-home page
await evaluate(`location.hash = '#/settings'`);
await sleep(400);
await evaluate(`document.querySelector('.skip-link').focus()`);
await tab(); // ensure focus ring is on the link
out.skip = await evaluate(`(async () => {
  const link = document.querySelector('.skip-link');
  link.focus();
  link.click();
  await new Promise((r) => setTimeout(r, 300));
  return {
    hash: location.hash,
    active: document.activeElement?.tagName + '#' + document.activeElement?.id,
    heading: document.querySelector('h1')?.textContent,
    scrollY: Math.round(window.scrollY),
  };
})()`);

// In-app navigation moves focus to main
out.routeFocus = await evaluate(`(async () => {
  const link = [...document.querySelectorAll('.nav-link')].find((a) => a.textContent.includes('Knowledge'));
  link.focus();
  link.click();
  await new Promise((r) => setTimeout(r, 400));
  return {
    hash: location.hash,
    active: document.activeElement?.tagName + '#' + document.activeElement?.id,
    title: document.title,
  };
})()`);

// Theme radiogroup: one tab stop + arrow keys
await evaluate(`location.hash = '#/appearance'`);
await sleep(500);
out.radioGroup = await evaluate(`(() => {
  const groups = [...document.querySelectorAll('[role="radiogroup"]')];
  return groups.map((g) => ({
    label: g.getAttribute('aria-label'),
    tabs: [...g.querySelectorAll('[role="radio"]')].map((r) => ({
      name: r.textContent.trim().slice(0, 24),
      tabIndex: r.tabIndex,
      checked: r.getAttribute('aria-checked'),
    })),
  }));
})()`);
await evaluate(`document.querySelector('.theme-choice-grid [role="radio"][aria-checked="true"]').focus()`);
await key('ArrowRight', 'ArrowRight', 39);
out.arrowRight = await evaluate(`(() => {
  const checked = document.querySelector('.theme-choice-grid [role="radio"][aria-checked="true"]');
  const all = [...document.querySelectorAll('.theme-choice-grid [role="radio"]')];
  return {
    checked: checked?.textContent.trim().slice(0, 20),
    focused: document.activeElement?.textContent.trim().slice(0, 20),
    tabStops: all.filter((r) => r.tabIndex === 0).length,
    theme: document.documentElement.dataset.theme,
  };
})()`);
// restore web
await evaluate(`(() => {
  const web = [...document.querySelectorAll('.theme-choice-grid [role="radio"]')][0];
  web.click();
})()`);
await sleep(500);

// Tabs semantics
await evaluate(`location.hash = '#/network'`);
await sleep(600);
out.tabs = await evaluate(`(() => {
  const group = document.querySelector('.tabs');
  if (!group) return null;
  return {
    role: group.getAttribute('role'),
    label: group.getAttribute('aria-label'),
    pressed: [...group.querySelectorAll('.tab')].map((t) => t.getAttribute('aria-pressed')),
  };
})()`);

// Graph node focus ring
out.graphFocus = await evaluate(`(() => {
  const node = document.querySelector('.graph-node');
  if (!node) return null;
  node.focus();
  const shape = node.querySelector('.node-shape');
  const s = shape ? getComputedStyle(shape) : null;
  return {
    focused: document.activeElement === node,
    stroke: s?.stroke,
    strokeWidth: s?.strokeWidth,
    label: node.getAttribute('aria-label')?.slice(0, 60),
  };
})()`);

// Reflow at 200% zoom equivalent (640 CSS px) and 320 px
await send('Emulation.setDeviceMetricsOverride', {
  width: 640,
  height: 720,
  deviceScaleFactor: 2,
  mobile: false,
});
out.reflow640 = {};
for (const route of ['home', 'network', 'knowledge', 'places', 'nodal-locations', 'settings']) {
  await evaluate(`location.hash = '#/${route}'`);
  await sleep(350);
  out.reflow640[route] = await evaluate(
    `({ overflow: document.documentElement.scrollWidth - innerWidth, scrollWidth: document.documentElement.scrollWidth })`,
  );
}
await send('Emulation.setDeviceMetricsOverride', {
  width: 320,
  height: 720,
  deviceScaleFactor: 2,
  mobile: true,
});
out.reflow320 = {};
for (const route of ['home', 'network', 'knowledge', 'places', 'nodal-locations', 'settings']) {
  await evaluate(`location.hash = '#/${route}'`);
  await sleep(350);
  out.reflow320[route] = await evaluate(
    `({ overflow: document.documentElement.scrollWidth - innerWidth, scrollWidth: document.documentElement.scrollWidth })`,
  );
}

// Small targets after the fix
out.smallTargets = await evaluate(`(() => {
  return [...document.querySelectorAll('a[href],button,[role="button"],[role="radio"]')]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 36), w: Math.round(r.width), h: Math.round(r.height) };
    })
    .filter((n) => n.w > 0 && n.h > 0 && (n.w < 24 || n.h < 24));
})()`);

// Reduced motion: theme switch still applies instantly
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await evaluate(`location.hash = '#/appearance'`);
await sleep(400);
await evaluate(`(() => { const p = [...document.querySelectorAll('.theme-choice-grid [role="radio"]')][1]; p.click(); })()`);
await sleep(500);
out.reducedMotion = await evaluate(`({ theme: document.documentElement.dataset.theme, motion: matchMedia('(prefers-reduced-motion: reduce)').matches })`);
await send('Emulation.setEmulatedMedia', { features: [] });

fs.writeFileSync(new URL('./a11y-probe2-results.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
ws.close();
await fetch(`${CDP}/json/close/${target.id}`);
