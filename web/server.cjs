// 本機靜態伺服器：只用 Node 內建模組，只監聽 127.0.0.1。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8770);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function resolvePath(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const file = path.resolve(ROOT, `.${pathname === '/' ? '/index.html' : pathname}`);
  // 擋掉 ../ 跳出網站根目錄
  return file.startsWith(ROOT + path.sep) ? file : null;
}

const server = http.createServer((req, res) => {
  let file;
  try {
    file = resolvePath(req.url);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (!file || path.basename(file) === 'server.cjs') {
    res.writeHead(404);
    return res.end('Not found');
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `連接埠 ${PORT} 已被占用，請改用 PORT=xxxx` : error.message);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log(`Ginza city: http://127.0.0.1:${PORT}`));
