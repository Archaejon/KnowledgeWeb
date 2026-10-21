# Audit harness

The browser checks behind [docs/accessibility-audit.md](../docs/accessibility-audit.md)
and the knowledge-attachment verification. They drive a real Chromium over the
DevTools protocol, so they measure the rendered interface rather than a
simulated DOM.

These scripts are development tools: they are not imported by the app, not part
of the production bundle and not run in CI, because they need a running dev
server plus a Chromium debugging endpoint. Everything else in `.tooling/`
(Node runtime, Chrome profiles, logs, result JSON) stays untracked.

## Requirements

- Node.js 22+ (the scripts use the global `WebSocket`).
- The dev server: `npm run dev` → <http://127.0.0.1:5178>.
- Chromium started with remote debugging. Use a profile directory that is
  disposable, because the probes interact with the app and change node settings
  in that profile:

  ```bash
  chrome --remote-debugging-port=9222 \
         --user-data-dir=.tooling/chrome-profile \
         --no-first-run --no-default-browser-check
  ```

  On Windows the executable is something like
  `"C:\Program Files\Google\Chrome\Application\chrome.exe"`.

Run the scripts from the repository root; they resolve their own assets from
`import.meta.dirname` and the token matrix reads `src/styles/app.css`.

## Scripts

| Command | What it verifies | Output |
| --- | --- | --- |
| `node .tooling/a11y-audit.mjs` | axe-core 4.10.2 (WCAG 2.0/2.1/2.2 A–AA + best practice) on 16 routes × 3 themes, desktop and mobile viewports | `a11y-results.json`, `a11y-summary.json` |
| `node .tooling/a11y-contrast.mjs` | Rendered-pixel contrast: screenshots each page, samples text boxes and compares the dominant surface with the computed text colour | `a11y-contrast-results.json` |
| `node .tooling/a11y-tokens.mjs` | 30 token text/background pairings per theme, parsed from `src/styles/app.css`; no browser needed | prints a pass/fail matrix |
| `node .tooling/a11y-probe2.mjs` | Skip link, per-route titles, focus after navigation, focus rings, radio-group keys, reflow at 320 px and 200 % zoom, target sizes | `a11y-probe2-results.json` |
| `node .tooling/probe-inert.mjs` | Dialog portal, `inert` background, hit-testing, Tab containment, Escape, focus restore | 16 checks; exits non-zero on failure |
| `node .tooling/probe-knowledge-files.mjs` | Attachment upload in several formats, a real `MediaRecorder` capture, persistence across reload, download links, transcript boundary | `screenshots/knowledge-attachments-*.png`; exits non-zero on failure |

`a11y-contrast-sampler.js` is injected into the page by `a11y-contrast.mjs` and
is not run directly. `axe.min.js` is the vendored axe-core build (4.10.2).

`probe-knowledge-files.mjs` needs a second browser on port **9223** with a fake
media device, because the voice-note path records real audio:

```bash
chrome --remote-debugging-port=9223 \
       --user-data-dir=.tooling/chrome-voice-profile \
       --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
       --autoplay-policy=no-user-gesture-required
```

## Build check

`serve-dist.mjs` is not an audit. It serves `dist/` under a subpath so the
production build can be checked the way a Codeberg Pages project site serves it,
including the router, the route chunks, the favicon and the manifest:

```bash
npm run build
PREFIX=KnowledgeWeb node .tooling/serve-dist.mjs --check   # verifies and exits
PREFIX=KnowledgeWeb node .tooling/serve-dist.mjs           # http://127.0.0.1:4190/KnowledgeWeb/
```

`--check` reads the built files directly: it follows the asset URLs in
`index.html`, requires them to be relative, confirms the entry chunk, stylesheet,
favicon and manifest exist and are non-empty, and checks the manifest's scope. It
uses no socket, so it behaves the same locally and inside a CI container, and it
sets a non-zero exit code on any failure — CI runs it on every push. Without
`--check` the server stays up for a real browser. The prefix is read from
`PREFIX` because Git Bash rewrites an argument that looks like a POSIX path into a
Windows path. No browser debugging port is needed for this one; open the page
normally.

## Reading results

The dev server and the browser must already be up; the scripts open a fresh tab
per run and leave it open, so close the extra tabs when you are done.

- `a11y-audit.mjs` prints a per-page table and writes both JSON files. Read
  `violations` in `a11y-results.json`; the counts in the audit document come
  from `a11y-summary.json`.
- `a11y-contrast.mjs` reports every sampled text box that falls below 4.5:1
  (3:1 for large text) and writes the full sample set.
- The interaction probes and `probe-inert.mjs` print one line per check.
  `a11y-audit.mjs`, `probe-inert.mjs` and `probe-knowledge-files.mjs` set a
  non-zero exit code; the remaining probes must be read rather than trusted to
  fail a pipeline.
- `a11y-audit.mjs` and `a11y-contrast.mjs` load each route as a fresh document and
  wait for the route chunk, because every page except Home is code-split.
- The probes assume the sample data and the default acting identity. Restore
  it with **Node settings → Reset sample data** if a previous run changed it.

## Limits

These scripts do not replace a manual screen-reader pass, and the contrast
sampler skips SVG chart labels. See "Remaining limits" in
[docs/accessibility-audit.md](../docs/accessibility-audit.md).
