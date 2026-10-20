// Tiny stand-in for the Supabase API gateway: routes /auth/v1 to Supabase Auth
// and /rest/v1 to PostgREST, so @supabase/supabase-js works against the local stack.
// /storage/v1 is a minimal file store on disk (upload, signed links, download, remove) for tests;
// it checks only that the caller is signed in, not the storage policies (DB tests cover those).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const STORE = process.env.STORAGE_DIR ?? '/tmp/businessgroup-local-stack/storage';
const safe = (p) => p.split('/').filter((x) => x && x !== '..' && x !== '.').join('/');
function role(req) {
  const tok = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    return JSON.parse(Buffer.from(tok.split('.')[1] ?? '', 'base64url').toString()).role ?? 'anon';
  } catch {
    return 'anon';
  }
}
/** supabase-js sends Blob/File uploads as multipart form data: pull out the file part. */
function filePart(req, body) {
  const ct = req.headers['content-type'] ?? 'application/octet-stream';
  const b = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!ct.startsWith('multipart/form-data') || !b) return { data: body, type: ct };
  const sep = Buffer.from(`--${b[1] ?? b[2]}`);
  let at = body.indexOf(sep);
  while (at !== -1) {
    const next = body.indexOf(sep, at + sep.length);
    if (next === -1) break;
    const part = body.subarray(at + sep.length + 2, next - 2);
    const split = part.indexOf('\r\n\r\n');
    const head = part.subarray(0, split).toString();
    if (/filename=/i.test(head)) return { data: part.subarray(split + 4), type: head.match(/content-type:\s*([^\r\n]+)/i)?.[1] ?? 'application/octet-stream' };
    at = next;
  }
  return { data: body, type: ct };
}

function storage(req, res, url) {
  const send = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify(body));
  };
  const u = new URL(url, 'http://x');
  const rest = u.pathname.slice('/storage/v1'.length);
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    let m;
    if (req.method === 'GET' && (m = rest.match(/^\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/))) {
      const file = path.join(STORE, m[1], safe(decodeURIComponent(m[2])));
      if (!fs.existsSync(file)) return send(404, { message: 'Object not found' });
      const type = fs.existsSync(`${file}.type`) ? fs.readFileSync(`${file}.type`, 'utf8') : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'access-control-allow-origin': '*' });
      return fs.createReadStream(file).pipe(res);
    }
    if (role(req) === 'anon') return send(403, { message: 'not signed in' });
    if (req.method === 'POST' && (m = rest.match(/^\/object\/sign\/([^/]+)$/))) {
      const { paths = [] } = JSON.parse(body.toString() || '{}');
      return send(200, paths.map((p) => ({ path: p, signedURL: `/object/sign/${m[1]}/${safe(p)}?token=local`, error: null })));
    }
    if (req.method === 'POST' && (m = rest.match(/^\/object\/sign\/([^/]+)\/(.+)$/)))
      return send(200, { signedURL: `/object/sign/${m[1]}/${safe(decodeURIComponent(m[2]))}?token=local` });
    if ((req.method === 'POST' || req.method === 'PUT') && (m = rest.match(/^\/object\/([^/]+)\/(.+)$/))) {
      const file = path.join(STORE, m[1], safe(decodeURIComponent(m[2])));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const { data, type } = filePart(req, body);
      fs.writeFileSync(file, data);
      fs.writeFileSync(`${file}.type`, type);
      return send(200, { Key: `${m[1]}/${safe(decodeURIComponent(m[2]))}` });
    }
    if (req.method === 'DELETE' && (m = rest.match(/^\/object\/([^/]+)$/))) {
      const { prefixes = [] } = JSON.parse(body.toString() || '{}');
      for (const p of prefixes) for (const f of [path.join(STORE, m[1], safe(p))]) [f, `${f}.type`].forEach((x) => fs.rmSync(x, { force: true }));
      return send(200, prefixes.map((p) => ({ name: p })));
    }
    send(404, { message: 'not available in local stack' });
  });
}

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const AUTH = Number(process.env.AUTH_PORT ?? 54323);
const REST = Number(process.env.REST_PORT ?? 54324);

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  if (url.startsWith('/storage/v1')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      });
      return res.end();
    }
    return storage(req, res, url);
  }
  let port;
  let path;
  if (url.startsWith('/auth/v1')) {
    port = AUTH;
    path = url.slice('/auth/v1'.length) || '/';
  } else if (url.startsWith('/rest/v1')) {
    port = REST;
    path = url.slice('/rest/v1'.length) || '/';
  } else {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'not available in local stack' }));
    return;
  }
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  const upstream = http.request({ host: '127.0.0.1', port, path, method: req.method, headers }, (up) => {
    const out = { ...up.headers, 'access-control-allow-origin': '*' };
    res.writeHead(up.statusCode ?? 502, out);
    up.pipe(res);
  });
  upstream.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: String(e) }));
  });
  req.pipe(upstream);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`gateway on http://127.0.0.1:${PORT}`);
});
