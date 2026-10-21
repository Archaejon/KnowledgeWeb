// Verifies that a dialog is portalled out of #root, that the app root is inert
// while it is open, and that keyboard containment and focus restore still hold.
const CDP = 'http://127.0.0.1:9222';
const BASE = 'http://127.0.0.1:5178';

const target = await (
  await fetch(`${CDP}/json/new?${encodeURIComponent(BASE + '/#/communities')}`, { method: 'PUT' })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
await new Promise((resolve) => (ws.onopen = resolve));
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const next = ++id;
    pending.set(next, resolve);
    ws.send(JSON.stringify({ id: next, method, params }));
  });
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
  return response.result?.result?.value;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const press = async (key, code, windowsVirtualKeyCode) => {
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
  });
};

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await sleep(1600);

const trigger = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Create community');
  if (!button) return null;
  button.scrollIntoView({ block: 'center' });
  const rect = button.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, label: button.textContent.trim() };
})()`);
if (!trigger) throw new Error('Create community trigger not found');
// A real pointer click, so the browser moves focus the way a user would.
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: trigger.x, y: trigger.y, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: trigger.x, y: trigger.y, button: 'left', clickCount: 1 });
await sleep(300);

const opened = await evaluate(`(() => {
  const root = document.getElementById('root');
  const dialog = document.querySelector('[role="dialog"]');
  const toastRegion = document.querySelector('.toasts');
  return {
    hasDialog: Boolean(dialog),
    rootInert: root.hasAttribute('inert') && root.inert === true,
    dialogOutsideRoot: Boolean(dialog && !root.contains(dialog)),
    dialogOnBody: dialog?.closest('body') === document.body && !root.contains(dialog),
    focusInside: Boolean(dialog && dialog.contains(document.activeElement)),
    toastOutsideRoot: Boolean(toastRegion && !root.contains(toastRegion)),
    ariaModal: dialog?.getAttribute('aria-modal'),
    headingLevel: dialog?.querySelector('h2')?.tagName,
    bodyOverflow: document.body.style.overflow,
  };
})()`);
check('dialog is portalled outside #root', opened.hasDialog && opened.dialogOutsideRoot && opened.dialogOnBody);
check('#root is inert while the dialog is open', opened.rootInert, `inert=${opened.rootInert}`);
check('focus moved inside the dialog', opened.focusInside, await evaluate(`document.activeElement?.tagName`));
check('toast live region stays outside the inert root', opened.toastOutsideRoot);
check('dialog keeps aria-modal and a level-2 heading', opened.ariaModal === 'true' && opened.headingLevel === 'H2');
check('body scroll is locked', opened.bodyOverflow === 'hidden');

// Tab through the whole dialog and wrap: focus must never leave it.
const seen = [];
let escaped = 0;
for (let i = 0; i < 14; i += 1) {
  await press('Tab', 'Tab', 9);
  const state = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const active = document.activeElement;
    return {
      inside: Boolean(dialog && dialog.contains(active)),
      name: active?.getAttribute('aria-label') || active?.getAttribute('id') || active?.tagName,
    };
  })()`);
  seen.push(state.name);
  if (!state.inside) escaped += 1;
}
check('Tab is contained by the dialog (14 presses)', escaped === 0, seen.join(' > '));

// Shift+Tab from the first item wraps to the last.
await press('Tab', 'Tab', 9);
await send('Input.dispatchKeyEvent', {
  type: 'rawKeyDown',
  key: 'Tab',
  code: 'Tab',
  windowsVirtualKeyCode: 9,
  modifiers: 8,
});
await send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'Tab',
  code: 'Tab',
  windowsVirtualKeyCode: 9,
  modifiers: 8,
});
const wrapped = await evaluate(`(() => {
  const dialog = document.querySelector('[role="dialog"]');
  return { inside: dialog.contains(document.activeElement), name: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().slice(0, 24) };
})()`);
check('Shift+Tab wraps inside the dialog', wrapped.inside, wrapped.name);

// The inert app must not be hit-testable behind the dialog.
const hitTest = await evaluate(`(() => {
  const root = document.getElementById('root');
  const navLink = [...root.querySelectorAll('.nav-link')].find((el) => el.textContent.includes('Network'));
  const rect = navLink.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return {
    inertAncestor: Boolean(navLink.closest('[inert]')),
    hitIsApp: root.contains(hit),
    hitClass: typeof hit?.className === 'string' ? hit.className : '',
    dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
  };
})()`);
check(
  'inert sidebar is not hit-testable while the dialog is open',
  hitTest.inertAncestor && !hitTest.hitIsApp && hitTest.dialogOpen,
  `hit=${hitTest.hitClass}`,
);

// Escape closes the top dialog, releases inert and returns focus to the trigger.
await press('Escape', 'Escape', 27);
await sleep(300);
const closed = await evaluate(`(() => {
  const root = document.getElementById('root');
  const active = document.activeElement;
  return {
    dialogGone: !document.querySelector('[role="dialog"]'),
    rootInert: root.hasAttribute('inert'),
    focusRestored: active?.textContent?.trim() === 'Create community',
    activeTag: active?.tagName,
    bodyOverflow: document.body.style.overflow,
  };
})()`);
check('Escape closes the dialog', closed.dialogGone);
check('inert is removed once the dialog closes', !closed.rootInert);
check('focus returns to the trigger', closed.focusRestored, `${closed.activeTag} "${await evaluate('document.activeElement?.textContent?.trim().slice(0, 40)')}"`);
check('body scroll is restored', closed.bodyOverflow === '');

// A re-render while the dialog is open must not steal focus back to the first field.
await evaluate(`[...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Create community').click()`);
await sleep(250);
await press('Tab', 'Tab', 9);
await press('Tab', 'Tab', 9);
const beforeRerender = await evaluate(`document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('id') || document.activeElement?.getAttribute('aria-label'))`);
await evaluate(`window.dispatchEvent(new Event('resize'))`);
await sleep(150);
const afterRerender = await evaluate(`document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('id') || document.activeElement?.getAttribute('aria-label'))`);
check('focus is not reset by a parent re-render', beforeRerender === afterRerender, `${beforeRerender} -> ${afterRerender}`);

// Reopening after close still locks down correctly, and the dialog can be
// dismissed with its own close button.
await evaluate(`document.querySelector('[role="dialog"] button[aria-label="Close dialog"]').click()`);
await sleep(250);
const reopened = await evaluate(`(() => {
  const root = document.getElementById('root');
  return { closed: !document.querySelector('[role="dialog"]'), inert: root.hasAttribute('inert') };
})()`);
check('close button releases inert', reopened.closed && !reopened.inert);

// Navigating out of a dialog (the mobile "More" menu) must not leave the app
// permanently inert when the dialog unmounts with the page.
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate(`location.hash = '#/home'`);
await sleep(700);
const moreButton = await evaluate(`(() => {
  const button = [...document.querySelectorAll('.mobile-nav button')].find((el) => el.textContent.includes('More'));
  if (!button) return null;
  button.scrollIntoView({ block: 'center' });
  const rect = button.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
})()`);
if (!moreButton) throw new Error('More button not found');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...moreButton, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...moreButton, button: 'left', clickCount: 1 });
await sleep(300);
const menuOpen = await evaluate(`document.getElementById('root').hasAttribute('inert')`);
const settingsItem = await evaluate(`(() => {
  const item = [...document.querySelectorAll('.more-nav-link')].find((el) => el.textContent.includes('Node settings'));
  if (!item) return null;
  item.scrollIntoView({ block: 'center' });
  const rect = item.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
})()`);
if (!settingsItem) throw new Error('Settings item not found in More menu');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...settingsItem, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...settingsItem, button: 'left', clickCount: 1 });
await sleep(600);
const navigated = await evaluate(`(() => {
  const root = document.getElementById('root');
  return {
    hash: location.hash,
    dialogGone: !document.querySelector('[role="dialog"]'),
    inert: root.hasAttribute('inert'),
    overflow: document.body.style.overflow,
  };
})()`);
check(
  'navigating out of a dialog releases inert',
  menuOpen && navigated.dialogGone && navigated.hash === '#/settings' && !navigated.inert && navigated.overflow === '',
  JSON.stringify(navigated),
);

const failures = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
ws.close();
await fetch(`${CDP}/json/close/${target.id}`);
if (failures.length > 0) process.exitCode = 1;
