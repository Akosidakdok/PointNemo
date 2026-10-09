import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = ['assets/prepared/', 'src/assets/', 'preview/'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'preview/index.html';
    if (!allowed.some((prefix) => path.startsWith(prefix))) { res.writeHead(404); res.end('Not found'); return; }
    const absolute = resolve(root, path);
    if (!absolute.startsWith(resolve(root) + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    const data = await readFile(absolute);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(8080, '127.0.0.1', () => console.log('Asset preview: http://127.0.0.1:8080'));
