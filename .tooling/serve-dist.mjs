// Serves dist/ under a subpath so the production build can be checked the way a
// Codeberg Pages project site serves it: https://<user>.codeberg.page/<repo>/
//
//   node .tooling/serve-dist.mjs [prefix] [port]
//
// Defaults: prefix /KnowledgeWeb/, port 4190. Local verification only.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

// PREFIX exists because Git Bash rewrites an argument that looks like a POSIX
// path into a Windows path; an environment variable is left alone.
const prefix = (process.env.PREFIX ?? process.argv[2] ?? '/KnowledgeWeb/')
  .replace(/^\/*/, '/')
  .replace(/\/?$/, '/');
const port = Number(process.argv[3] ?? 4190);
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

server.listen(port, '127.0.0.1', () => {
  console.log(`dist served at http://127.0.0.1:${port}${prefix}`);
});
