// Serves dist/ under a subpath so the production build can be checked the way a
// Codeberg Pages project site serves it: https://<user>.codeberg.page/<repo>/
//
//   node .tooling/serve-dist.mjs            # serve for manual checking
//   node .tooling/serve-dist.mjs --check    # verify and exit
//
// Defaults: prefix /KnowledgeWeb/, port 4190. Local verification only.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

// PREFIX exists because Git Bash rewrites an argument that looks like a POSIX
// path into a Windows path; an environment variable is left alone.
const check = process.argv.includes('--check');
const positional = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const prefix = (process.env.PREFIX ?? positional ?? '/KnowledgeWeb/')
  .replace(/^[A-Za-z]:.*[\\/]/, '/') // a Git Bash-mangled argument
  .replace(/^[\\/]*/, '/')
  .replace(/[\\/]*$/, '/');
const port = Number(process.env.PORT ?? 4190);
const root = join(process.cwd(), 'dist');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (!url.pathname.startsWith(prefix)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`Not under ${prefix}\n`);
    return;
  }
  const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
  const target = join(root, normalize(relative).replaceAll(sep, '/'));
  if (!target.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, 'index.html') : target;
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found\n');
  }
});

const origin = () => `http://127.0.0.1:${port}${prefix}`;

async function verify() {
  const failures = [];
  const checkOne = async (label, path, expectedType, extra) => {
    const response = await fetch(`${origin()}${path}`);
    const body = await response.text();
    let ok = response.ok && response.headers.get('content-type') === expectedType;
    let detail = `${response.status} ${response.headers.get('content-type')}`;
    if (ok && extra) {
      const problem = extra(body);
      if (problem) {
        ok = false;
        detail = problem;
      }
    }
    if (!ok) failures.push(label);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  — ${detail}`);
  };

  const html = await readFile(join(root, 'index.html'), 'utf8');
  // Relative URLs are the property under test: an absolute /assets/... path
  // works at a domain root and silently 404s on a project subpath.
  const assetPath = (tag) => {
    if (!tag) return { fail: 'tag missing from index.html' };
    if (/^([a-z]+:)?[\\/]/i.test(tag)) return { fail: `URL is absolute: ${tag}` };
    return { path: tag.replace(/^\.\//, '') };
  };
  const script = assetPath(html.match(/src="([^"]+\.js)"/)?.[1]);
  const style = assetPath(html.match(/href="([^"]+\.css)"/)?.[1]);

  await checkOne('index.html at the subpath', '', 'text/html; charset=utf-8', (body) =>
    body.includes('<div id="root">') ? null : 'no root element',
  );

  if (script.fail) {
    failures.push(`entry chunk: ${script.fail}`);
    console.log(`FAIL  entry chunk  — ${script.fail}`);
  } else {
    await checkOne(
      'entry chunk (relative URL)',
      script.path,
      'text/javascript; charset=utf-8',
      (body) => (body.length > 1000 ? null : 'chunk is suspiciously small'),
    );
  }

  if (style.fail) {
    failures.push(`stylesheet: ${style.fail}`);
    console.log(`FAIL  stylesheet  — ${style.fail}`);
  } else {
    await checkOne('stylesheet (relative URL)', style.path, 'text/css; charset=utf-8');
  }

  await checkOne('favicon', 'favicon.svg', 'image/svg+xml');
  await checkOne('web app manifest', 'manifest.webmanifest', 'application/manifest+json', (body) => {
    try {
      const manifest = JSON.parse(body);
      const start = new URL(manifest.start_url, `${origin()}manifest.webmanifest`).pathname;
      const scope = new URL(manifest.scope, `${origin()}manifest.webmanifest`).pathname;
      return start === prefix && scope === prefix
        ? null
        : `start_url ${start} / scope ${scope} do not match ${prefix}`;
    } catch {
      return 'manifest is not valid JSON';
    }
  });

  if (failures.length > 0) {
    console.log(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nbuild serves correctly from a subpath');
  }
}

server.listen(port, '127.0.0.1', async () => {
  if (!check) {
    console.log(`dist served at ${origin()}`);
    return;
  }
  try {
    await verify();
  } catch (error) {
    console.error(`FAIL  ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
