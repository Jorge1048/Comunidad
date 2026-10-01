'use strict';
/* Manga PDF Manager — servidor de unión. Solo módulos de Node; requiere el binario `qpdf`. */
const http = require('http'), fs = require('fs'), fsp = fs.promises, path = require('path'), crypto = require('crypto');
const { spawn } = require('child_process'), { pipeline } = require('stream/promises');
const PORT = +process.env.PORT || 8080, DATA = process.env.DATA_DIR || './data',
  TTL = (+process.env.TTL_HOURS || 6) * 36e5, MAX_JOB = (+process.env.MAX_JOB_GB || 8) * 2 ** 30,
  MAX_JOBS = +process.env.MAX_JOBS || 20, ORIGIN = process.env.ALLOWED_ORIGIN || '*';
fs.mkdirSync(DATA, { recursive: true });

const dir = id => path.join(DATA, id), jf = id => path.join(dir(id), 'job.json');
const read = async id => JSON.parse(await fsp.readFile(jf(id), 'utf8'));
const write = (id, o) => fsp.writeFile(jf(id), JSON.stringify(o));
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
const body = req => new Promise((ok, ko) => { let s = ''; req.on('data', d => { s += d; if (s.length > 1e5) ko(new Error('cuerpo demasiado grande')); }); req.on('end', () => ok(s)); req.on('error', ko); });
async function uploaded(id) { // archivos completos: { índice: bytes }
  const out = {};
  for (const f of await fsp.readdir(dir(id))) { const m = f.match(/^(\d+)\.pdf$/); if (m) out[+m[1]] = (await fsp.stat(path.join(dir(id), f))).size; }
  return out;
}

/* qpdf lee los PDFs desde disco y escribe el resultado a disco: no carga los 2 GB en RAM. */
function merge(id, count, name) {
  const out = path.join(dir(id), 'out.pdf'), files = Array.from({ length: count }, (_, i) => path.join(dir(id), `${i}.pdf`));
  const q = spawn('qpdf', ['--empty', '--pages', ...files, '--', out]); let err = '';
  q.stderr.on('data', d => { err = (err + d).slice(-600); });
  const fail = async msg => { await write(id, { ...(await read(id)), state: 'error', error: String(msg).split(dir(id) + path.sep).join('') }); }; // sin rutas internas
  q.on('error', e => fail('no se pudo ejecutar qpdf: ' + e.message));
  q.on('close', async code => {
    try {
      if (code !== 0 && code !== 3) return fail(err.trim() || `qpdf terminó con código ${code}`); // 3 = avisos, el archivo es válido
      const size = (await fsp.stat(out)).size;
      if (!size) return fail('el PDF generado está vacío');
      await write(id, { ...(await read(id)), state: 'done', name, size });
      files.forEach(f => fsp.unlink(f).catch(() => {})); // se borran los originales apenas hay resultado
    } catch (e) { fail(e.message); }
  });
}

async function download(req, res, id) {
  const j = await read(id);
  if (j.state !== 'done') return json(res, 404, { error: 'todavía no está listo' });
  const size = j.size, m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let start = 0, end = size - 1, code = 200;
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], end); } else start = Math.max(0, size - +m[2]);
    code = 206;
    if (start > end) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
  }
  const fn = (j.name || 'manga') + '.pdf';
  const h = { 'content-type': 'application/pdf', 'content-length': end - start + 1, 'accept-ranges': 'bytes',
    'content-disposition': `attachment; filename="${fn.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fn).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}` };
  if (code === 206) h['content-range'] = `bytes ${start}-${end}/${size}`;
  res.writeHead(code, h);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(path.join(dir(id), 'out.pdf'), { start, end }).on('error', () => res.destroy()).pipe(res);
}

http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', ORIGIN);
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,HEAD,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, range');
  res.setHeader('access-control-expose-headers', 'content-length, content-range, accept-ranges');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, 'http://x'), p = u.pathname.split('/').filter(Boolean);
  try {
    if (!p.length) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return fs.createReadStream(path.join(__dirname, 'public', 'index.html')).on('error', () => res.end('Manga PDF Manager')).pipe(res); }
    if (p[0] === 'api' && p[1] === 'health') return json(res, 200, { ok: true, ttlHours: TTL / 36e5 });
    if (p[0] === 'api' && p[1] === 'jobs' && !p[2] && req.method === 'POST') {
      if ((await fsp.readdir(DATA)).length >= MAX_JOBS) return json(res, 429, { error: 'servidor ocupado, intenta más tarde' });
      const id = crypto.randomBytes(16).toString('hex');
      await fsp.mkdir(dir(id)); await write(id, { created: Date.now(), state: 'uploading' });
      return json(res, 201, { id });
    }
    const id = p[0] === 'api' ? p[2] : p[0] === 'd' ? p[1] : null;
    if (!id) return json(res, 404, { error: 'no encontrado' });
    if (!/^[a-f0-9]{32}$/.test(id) || !fs.existsSync(jf(id))) return json(res, 404, { error: 'trabajo no encontrado o expirado' });
    if (p[0] === 'd') return await download(req, res, id);

    if (p[3] === undefined && req.method === 'GET') return json(res, 200, { ...(await read(id)), files: await uploaded(id) });
    if (p[3] === 'files' && /^\d+$/.test(p[4]) && req.method === 'PUT') {
      const expected = +u.searchParams.get('size'), have = await uploaded(id);
      if (!expected || Object.values(have).reduce((a, b) => a + b, 0) + expected > MAX_JOB) return json(res, 413, { error: 'el lote supera el máximo permitido' });
      const tmp = path.join(dir(id), `${p[4]}.part`);
      try { await pipeline(req, fs.createWriteStream(tmp)); } catch (e) { await fsp.unlink(tmp).catch(() => {}); throw e; }
      if ((await fsp.stat(tmp)).size !== expected) { await fsp.unlink(tmp); return json(res, 400, { error: 'subida incompleta' }); }
      await fsp.rename(tmp, path.join(dir(id), `${p[4]}.pdf`));
      return json(res, 200, { ok: true });
    }
    if (p[3] === 'merge' && req.method === 'POST') {
      const { count, name } = JSON.parse(await body(req)), have = await uploaded(id), job = await read(id);
      if (job.state === 'merging' || job.state === 'done') return json(res, 202, job);
      for (let i = 0; i < count; i++) if (!have[i]) return json(res, 409, { error: `falta el archivo ${i}` });
      await write(id, { ...job, state: 'merging', name: String(name || 'manga').slice(0, 150) });
      merge(id, count, String(name || 'manga').slice(0, 150));
      return json(res, 202, { state: 'merging' });
    }
    json(res, 404, { error: 'no encontrado' });
  } catch (e) { if (!res.headersSent) json(res, 500, { error: e.message }); else res.destroy(); }
}).listen(PORT, () => console.log('Manga PDF Manager en el puerto', PORT));

/* Limpieza automática: borra trabajos más viejos que TTL_HOURS */
setInterval(async () => {
  for (const id of await fsp.readdir(DATA).catch(() => [])) {
    const st = await fsp.stat(dir(id)).catch(() => null);
    const created = await read(id).then(j => j.created, () => st && st.mtimeMs);
    if (st && Date.now() - created > TTL) fsp.rm(dir(id), { recursive: true, force: true });
  }
}, 10 * 60 * 1000).unref();
