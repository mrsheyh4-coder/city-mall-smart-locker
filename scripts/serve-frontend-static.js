const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { fail, ok, rootDir } = require('./shared');

const exportTargets = [
  path.join(rootDir, 'frontend', '.next-build'),
  path.join(rootDir, 'frontend', 'out'),
];
const frontendOutDir = exportTargets.find((target) => fs.existsSync(path.join(target, 'index.html')));
const port = Number(process.env.PORT ?? process.env.FRONTEND_PORT ?? 3000);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

if (!frontendOutDir) {
  fail('Static frontend export is missing. Run npm run demo:prepare first.');
  process.exit(1);
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const safePath = decodedPath.replace(/^\/+/, '').replaceAll('\\', '/');
  const candidates = [];

  if (!safePath || safePath === '/') {
    candidates.push('index.html');
  } else {
    candidates.push(safePath);
    if (!path.extname(safePath)) {
      candidates.push(`${safePath}.html`);
      candidates.push(path.join(safePath, 'index.html'));
    }
  }

  for (const candidate of candidates) {
    const absolutePath = path.resolve(frontendOutDir, candidate);
    if (!absolutePath.startsWith(frontendOutDir)) {
      continue;
    }

    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
  }

  return null;
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url ?? '/');

  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.setHeader('Surrogate-Control', 'no-store');

  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  ok(`Static frontend is running at http://localhost:${port}`);
  ok('Cache-Control is set to no-store for all frontend assets');
});
