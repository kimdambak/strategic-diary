// 로컬 확인용 서버 (패키지 설치 불필요): npm run dev → http://localhost:3000
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import briefing from '../api/briefing.js';

const root = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};
const port = Number(process.env.PORT) || 3000;

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/api/briefing') {
    // Vercel 의 res.status().json() 모양을 흉내 낸다.
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
    return briefing(req, res);
  }

  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end('forbidden'); }
  try {
    const body = await readFile(file);
    res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(port, () => console.log(`전략 일기장: http://localhost:${port}`));
