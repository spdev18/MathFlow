// server/tiny-server.js
// Minimal static file server for local testing (no deps).
// Usage: node server/tiny-server.js --port 4001 --root .
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx+1]) return args[idx+1];
  return def;
};
const PORT = parseInt(getArg('--port', '4001'), 10);
const ROOT = path.resolve(getArg('--root', '.'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }
  const filePath = path.join(ROOT, pathname);

  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404); res.end('Not Found'); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[tiny-server] Serving ${ROOT} at http://localhost:${PORT}/`);
  console.log(`[tiny-server] Open http://localhost:${PORT}/C1/`);
});