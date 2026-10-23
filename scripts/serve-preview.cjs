const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const captures = path.resolve(__dirname, '../docs/verification');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/__capture' && process.env.WAYLO_CAPTURE === '1') { const name = url.searchParams.get('name'); if (!/^[a-z0-9-]+\.png$/.test(name ?? '')) { res.writeHead(400); res.end(); return; } let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 10_000_000) { res.writeHead(413); res.end(); return; } } fs.mkdirSync(captures, { recursive: true }); fs.writeFileSync(path.join(captures, name), Buffer.from(data, 'base64')); res.end('saved'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let file; try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { res.writeHead(400); res.end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  for (const candidate of [file, file + '.html', path.join(file, 'index.html')]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) { res.writeHead(200, { 'Content-Type': mime[path.extname(candidate)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); if (req.method === 'HEAD') res.end(); else fs.createReadStream(candidate).pipe(res); return; }
  res.writeHead(404); res.end('No exported route here. Run the web export first.');
}).listen(Number(process.env.PORT ?? 8097), '127.0.0.1', () => console.log('Waylo static preview ready.'));
