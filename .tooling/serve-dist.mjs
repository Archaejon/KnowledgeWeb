// Serves dist/ under a subpath so the production build can be checked the way a
// Codeberg Pages project site serves it: https://<user>.codeberg.page/<repo>/
//
//   node .tooling/serve-dist.mjs            # serve for manual checking
//   node .tooling/serve-dist.mjs --check    # verify the artifact and exit
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
// PORT=0 (set by some tooling) means "any free port", which is not useful here.
const port = Number(process.env.PORT) || 4190;
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

/**
 * The check runs on the built files rather than over HTTP: it reads index.html,
 * follows the asset URLs it finds, and asserts the properties that make one
 * artifact work at a project subpath. No socket, so it behaves the same on a
 * laptop and in a CI container.
 */
async function verify() {
  const failures = [];
  const pass = (label, detail) => console.log(`PASS  ${label}  — ${detail}`);
  const fail = (label, detail) => {
    failures.push(label);
    console.log(`FAIL  ${label}  — ${detail}`);
  };

  const exists = async (relative) => {
    try {
      const info = await stat(join(root, relative));
      return info.isFile() ? info.size : 0;
    } catch {
      return 0;
    }
  };

  let html;
  try {
    html = await readFile(join(root, 'index.html'), 'utf8');
  } catch {
    console.log('FAIL  dist/index.html  — run `npm run build` first');
    process.exitCode = 1;
    return;
  }

  if (html.includes('<div id="root">')) pass('index.html', 'has the app root');
  else fail('index.html', 'no #root element');

  // Relative URLs are the property under test: "/assets/..." works at a domain
  // root and silently 404s on a project subpath.
  for (const [label, pattern, ext] of [
    ['entry chunk', /src="([^"]+\.js)"/, '.js'],
    ['stylesheet', /href="([^"]+\.css)"/, '.css'],
  ]) {
    const tag = html.match(pattern)?.[1];
    if (!tag) {
      fail(label, 'no matching tag in index.html');
      continue;
    }
    if (/^([a-z]+:)?[\\/]/i.test(tag)) {
      fail(label, `URL is absolute: ${tag}`);
      continue;
    }
    const size = await exists(tag.replace(/^\.\//, ''));
    if (size > 1000) pass(`${label} (relative URL)`, `${tag}, ${size} bytes`);
    else fail(`${label} (relative URL)`, `${tag} is missing or empty in dist/`);
  }

  for (const [label, file, type] of [
    ['favicon', 'favicon.svg', 'image/svg+xml'],
    ['web app manifest', 'manifest.webmanifest', 'application/manifest+json'],
  ]) {
    const size = await exists(file);
    if (size > 0) pass(label, `${file}, ${size} bytes (${type})`);
    else fail(label, `${file} is missing from dist/`);
  }

  try {
    const manifest = JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'));
    const relative = (value) => !value || !/^([a-z]+:)?[\\/]/i.test(value);
    if (manifest.start_url === './' && manifest.scope === './') {
      pass('manifest scope', 'start_url and scope stay relative');
    } else {
      fail('manifest scope', `start_url ${manifest.start_url} / scope ${manifest.scope}`);
    }
    if (manifest.icons && !manifest.icons.every((icon) => relative(icon.src))) {
      fail('manifest icons', 'an icon URL is absolute');
    }
  } catch (error) {
    fail('manifest JSON', error instanceof Error ? error.message : String(error));
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`\nbuild is portable: it serves from ${prefix} without a rebuild`);
  }
}

if (check) {
  await verify();
} else {
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
  server.listen(port, '127.0.0.1', () => {
    console.log(`dist served at http://127.0.0.1:${port}${prefix}`);
  });
}
