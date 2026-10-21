// End-to-end check for knowledge attachments:
// uploads in arbitrary formats, a real MediaRecorder capture (fake audio
// device), persistence, download links and the transcription boundary.
const CDP = 'http://127.0.0.1:9223';
const BASE = 'http://127.0.0.1:5178';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
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
  if (response.result?.exceptionDetails) {
    throw new Error(
      response.result.exceptionDetails.exception?.description ?? response.result.exceptionDetails.text,
    );
  }
  return response.result?.result?.value;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 1000,
  // A slightly smaller raster keeps the saved screenshots reviewable.
  deviceScaleFactor: 0.75,
  mobile: false,
});
// A stand-in for a local Whisper-compatible server plus an error funnel.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errors = [];
    window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input && input.url ? input.url : '';
      if (url.includes('/v1/audio/transcriptions')) {
        return Promise.resolve(new Response(JSON.stringify({
          text: 'The swale held water for nine days after the May storms.',
        }), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      return originalFetch(input, init);
    };
  `,
});
await send('Page.navigate', { url: `${BASE}/#/knowledge` });
await sleep(2000);

const setValue = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) throw new Error('Missing field ' + ${JSON.stringify(selector)});
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

const clickText = (selector, text) => `(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
    .find((node) => node.textContent.trim().includes(${JSON.stringify(text)}));
  if (!el) throw new Error('No ${selector} containing ' + ${JSON.stringify(text)});
  el.click();
  return el.textContent.trim().slice(0, 60);
})()`;

// Start from a known state: AI and transcription off, whatever the profile did last run.
await evaluate(`(() => {
  const raw = localStorage.getItem('understory.node.v1');
  if (!raw) return false;
  const stored = JSON.parse(raw);
  stored.settings.ai = { enabled: false, provider: 'none', endpoint: '', model: '', timeoutMs: 8000 };
  localStorage.setItem('understory.node.v1', JSON.stringify(stored));
  return true;
})()`);
await evaluate('location.reload()');
await sleep(1800);

const title = `Attachment probe ${Date.now()}`;
await evaluate(clickText('button', 'New record'));
await sleep(400);
await evaluate(setValue('#k-title', title));
await evaluate(setValue('#k-body', 'Field notes with a binary trace, a CSV and a spoken note attached for later review.'));

// Two files in two formats, one of them with no known preview.
const added = await evaluate(`(async () => {
  const transfer = new DataTransfer();
  transfer.items.add(new File(['date,value\\n2026-01-01,4\\n2026-02-01,7\\n'], 'readings.csv', { type: 'text/csv' }));
  transfer.items.add(new File([new Uint8Array([0, 1, 2, 3, 250, 251, 252])], 'sensor-trace.bin', { type: 'application/octet-stream' }));
  const input = document.querySelector('.file-input');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 700));
  return {
    rows: document.querySelectorAll('.attachment-fieldset .attachment-row').length,
    names: [...document.querySelectorAll('.attachment-fieldset .attachment-name')].map((el) => el.textContent),
    counter: document.querySelector('.attachment-add .muted')?.textContent?.replace(/\\s+/g, ' ').trim(),
  };
})()`);
check('two files of different formats attach', added.rows === 2, added.names.join(', '));
check('editor shows the record budget', /2 of 6/.test(added.counter ?? ''), added.counter);

// Record with the fake audio device.
const recording = await evaluate(`(async () => {
  const start = [...document.querySelectorAll('.voice-recorder .btn')].find((el) => el.textContent.includes('Record a voice note'));
  start.click();
  await new Promise((resolve) => setTimeout(resolve, 900));
  const recordingNow = Boolean(document.querySelector('.voice-recorder-recording')) || Boolean(document.querySelector('.recorder-timer'));
  const status = document.querySelector('.voice-recorder-status')?.textContent?.trim();
  await new Promise((resolve) => setTimeout(resolve, 1400));
  const stop = [...document.querySelectorAll('.voice-recorder .btn')].find((el) => el.textContent.includes('Stop and keep'));
  if (!stop) return { recordingNow, status, stopped: false };
  stop.click();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const rows = [...document.querySelectorAll('.attachment-fieldset .attachment-row')];
  return {
    recordingNow,
    status,
    stopped: true,
    rows: rows.length,
    last: rows[rows.length - 1]?.textContent?.replace(/\\s+/g, ' ').trim(),
    timers: document.querySelectorAll('.recorder-timer').length,
  };
})()`);
check('recording starts and shows elapsed time', recording.recordingNow === true, recording.status);
check('recording stops into a third attachment', recording.stopped && recording.rows === 3, recording.last);
check('voice note is labelled with type, duration and size', /Voice note/.test(recording.last ?? '') && /\d+:\d\d/.test(recording.last ?? ''), recording.last);

await evaluate(clickText('.modal-foot button', 'Create record'));
await sleep(1000);
const saved = await evaluate(`(() => {
  const cardHeading = [...document.querySelectorAll('.card-head h2, .card h2')].find((el) => el.textContent.includes('Files and voice notes'));
  const rows = [...document.querySelectorAll('.attachment-row')];
  const stored = JSON.parse(localStorage.getItem('understory.node.v1'));
  const record = stored.data.knowledge.find((entry) => entry.title === ${JSON.stringify(title)});
  return {
    hash: location.hash,
    cardHeading: cardHeading?.textContent?.trim(),
    rows: rows.length,
    names: rows.map((row) => row.querySelector('.attachment-name')?.textContent),
    downloadHrefs: rows.map((row) => row.querySelector('.attachment-download')?.getAttribute('href')?.slice(0, 30)),
    storedAttachments: record?.attachments?.map((a) => ({ kind: a.kind, mime: a.mime, size: a.size, duration: a.durationSeconds, hasBytes: a.dataUrl.startsWith('data:') })),
    storageBytes: localStorage.getItem('understory.node.v1').length,
    errors: window.__errors,
  };
})()`);
check('record saves and navigates to its detail page', saved.hash.startsWith('#/knowledge/k-'), saved.hash);
check('detail page lists all three attachments', saved.rows === 3 && /3/.test(saved.cardHeading ?? ''), saved.names?.join(', '));
check('every attachment has a data URL download', saved.downloadHrefs.every((href) => href?.startsWith('data:')), saved.downloadHrefs[0]);
check('stored bytes and durations are correct', saved.storedAttachments?.length === 3 && saved.storedAttachments[0].size === 37 && saved.storedAttachments[1].size === 7 && saved.storedAttachments[2].kind === 'recording' && saved.storedAttachments[2].duration >= 1, JSON.stringify(saved.storedAttachments));
check('no runtime errors during upload or recording', Array.isArray(saved.errors) && saved.errors.length === 0, JSON.stringify(saved.errors));

// Transcription is honestly unavailable until configured.
const beforeConfig = await evaluate(`(() => {
  const transcribe = [...document.querySelectorAll('.attachment-transcribe .btn')][0];
  return {
    exists: Boolean(transcribe),
    disabled: transcribe?.disabled,
    reason: transcribe?.parentElement?.querySelector('.muted')?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 90),
    transcript: Boolean(document.querySelector('.attachment-transcript')),
  };
})()`);
check('transcribe is offered but disabled while no speech service is configured', beforeConfig.exists && beforeConfig.disabled === true, beforeConfig.reason);
check('no transcript exists before transcription', beforeConfig.transcript === false);

// Point the node at the fake local speech service, then reload.
const configured = await evaluate(`(() => {
  const stored = JSON.parse(localStorage.getItem('understory.node.v1'));
  stored.settings.ai = {
    ...stored.settings.ai,
    enabled: true,
    provider: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    model: 'llama3.2:3b',
    transcriptionEndpoint: 'http://127.0.0.1:8080/v1/audio/transcriptions',
    transcriptionModel: 'whisper-1',
  };
  localStorage.setItem('understory.node.v1', JSON.stringify(stored));
  return true;
})()`);
await send('Page.navigate', { url: `${BASE}/#/knowledge` });
await sleep(1500);
await send('Page.navigate', { url: `${BASE}/#/knowledge` });
await sleep(300);
await evaluate(`history.replaceState(null, '', location.hash)`);
await evaluate(`location.reload()`);
await sleep(1500);
check('settings for a speech service are stored', configured === true);

// Back on the record list; open the record and transcribe.
const opened = await evaluate(`(async () => {
  const link = [...document.querySelectorAll('.knowledge-card a, a')].find((el) => el.textContent.trim() === ${JSON.stringify(title)});
  if (!link) return false;
  link.click();
  await new Promise((resolve) => setTimeout(resolve, 700));
  return location.hash;
})()`);
check('record reopens after reload', typeof opened === 'string' && opened.startsWith('#/knowledge/'), opened);

const transcribe = await evaluate(`(async () => {
  const buttons = [...document.querySelectorAll('.attachment-transcribe .btn')];
  const button = buttons[0];
  if (!button) return { error: 'no transcribe button' };
  const enabled = !button.disabled;
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const transcript = document.querySelector('.attachment-transcript');
  const stored = JSON.parse(localStorage.getItem('understory.node.v1'));
  const record = stored.data.knowledge.find((entry) => entry.title === ${JSON.stringify(title)});
  const recording = record.attachments.find((entry) => entry.kind === 'recording');
  return {
    enabled,
    transcriptText: transcript?.querySelector('p')?.textContent?.trim(),
    transcriptVisible: Boolean(transcript),
    storedTranscript: recording?.transcript?.text,
    provider: recording?.transcript?.provider,
    model: recording?.transcript?.model,
    errors: window.__errors,
  };
})()`);
check('transcribe is enabled once a service is configured', transcribe.enabled === true);
check('transcript is stored on the recording', transcribe.storedTranscript === 'The swale held water for nine days after the May storms.', transcribe.storedTranscript);
check('transcript is shown on the record', transcribe.transcriptVisible && /swale held water/.test(transcribe.transcriptText ?? ''), transcribe.provider + ' / ' + transcribe.model);
check('no runtime errors during transcription', Array.isArray(transcribe.errors) && transcribe.errors.length === 0, JSON.stringify(transcribe.errors));

// Persistence of the transcript across a reload.
await evaluate('location.reload()');
await sleep(1500);
const persisted = await evaluate(`(() => ({
  transcript: document.querySelector('.attachment-transcript')?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 120),
  rows: document.querySelectorAll('.attachment-row').length,
}))()`);
check('attachments and transcript survive a reload', persisted.rows === 3 && /swale held water/.test(persisted.transcript ?? ''), persisted.transcript);

// Markdown export includes the files and the transcript.
const exported = await evaluate(`(() => {
  const data = JSON.parse(localStorage.getItem('understory.node.v1'));
  const record = data.data.knowledge.find((entry) => entry.title === ${JSON.stringify(title)});
  return { names: record.attachments.map((a) => a.name), transcript: record.attachments.find((a) => a.transcript)?.transcript?.text ?? '' };
})()`);
check('export data carries file names and transcript', exported.names.length === 3 && exported.transcript.includes('swale'), exported.names.join(', '));

// The Markdown export itself, downloaded through the real button.
const downloadDir = resolve('.tooling/downloads');
rmSync(downloadDir, { recursive: true, force: true });
mkdirSync(downloadDir, { recursive: true });
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
await evaluate(clickText('button', 'Export .md'));
await sleep(1200);
const exportedFile = readdirSync(downloadDir).find((name) => name.endsWith('.md'));
const markdown = exportedFile ? readFileSync(resolve(downloadDir, exportedFile), 'utf8') : '';
check(
  'Markdown export lists files and includes the transcript',
  Boolean(exportedFile) && markdown.includes('readings.csv') && markdown.includes('voice-note') && markdown.includes('The swale held water'),
  exportedFile ? `${exportedFile} (${markdown.length} chars)` : 'no download',
);

// axe-core over the detail page and the open editor, both of which are new UI.
const axeSource = readFileSync('.tooling/axe.min.js', 'utf8');
await evaluate(axeSource);
const axeRun = `(async () => {
  const result = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
  });
  return result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.length,
    help: violation.help,
  }));
})()`;
const axeDetail = await evaluate(axeRun);
check('axe finds no violations on the record detail page', axeDetail.length === 0, JSON.stringify(axeDetail));

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('screenshots/knowledge-attachments-detail.png', Buffer.from(shot.result.data, 'base64'));

// Re-open the editor to check the filled attachment list and audit it too.
await evaluate(clickText('button', 'Edit'));
await sleep(500);
await evaluate(`document.querySelector('.attachment-fieldset')?.scrollIntoView({ block: 'center' })`);
await sleep(300);
const axeEditor = await evaluate(axeRun);
check('axe finds no violations in the attachment editor', axeEditor.length === 0, JSON.stringify(axeEditor));
const shotEdit = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('screenshots/knowledge-attachments-editor-filled.png', Buffer.from(shotEdit.result.data, 'base64'));
// Remove one file through the editor: the record should update and a version is kept.
const removedFile = await evaluate(`(async () => {
  const row = [...document.querySelectorAll('.attachment-fieldset .attachment-row')]
    .find((entry) => entry.textContent.includes('sensor-trace.bin'));
  const button = row?.querySelector('button');
  if (!button) return { removed: false };
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const remaining = document.querySelectorAll('.attachment-fieldset .attachment-row').length;
  const save = [...document.querySelectorAll('.modal-foot button')].find((el) => el.textContent.includes('Save changes'));
  save.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  const stored = JSON.parse(localStorage.getItem('understory.node.v1'));
  const record = stored.data.knowledge.find((entry) => entry.title === ${JSON.stringify(title)});
  return {
    removed: true,
    remainingInEditor: remaining,
    storedNames: record.attachments.map((a) => a.name),
    versions: record.versions.length,
    rowsOnDetail: document.querySelectorAll('.attachment-row').length,
  };
})()`);
check(
  'removing a file in the editor updates the record and keeps a version',
  removedFile.removed && removedFile.remainingInEditor === 2 && removedFile.storedNames.length === 2 && !removedFile.storedNames.includes('sensor-trace.bin') && removedFile.versions === 1 && removedFile.rowsOnDetail === 2,
  `${removedFile.storedNames?.join(', ')} · versions=${removedFile.versions}`,
);

await evaluate(clickText('button', 'Delete'));
await sleep(400);
await evaluate(clickText('.modal-foot button', 'Delete record'));
await sleep(600);
const removed = await evaluate(`(() => {
  const data = JSON.parse(localStorage.getItem('understory.node.v1'));
  return {
    stillThere: data.data.knowledge.some((entry) => entry.title === ${JSON.stringify(title)}),
    hash: location.hash,
  };
})()`);
check('deleting the record removes its attachments too', removed.stillThere === false, removed.hash);
rmSync(downloadDir, { recursive: true, force: true });

const failures = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
ws.close();
await fetch(`${CDP}/json/close/${target.id}`);
if (failures.length > 0) process.exitCode = 1;
