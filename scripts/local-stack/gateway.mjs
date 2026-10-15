// Tiny stand-in for the Supabase API gateway: routes /auth/v1 to Supabase Auth
// and /rest/v1 to PostgREST, so @supabase/supabase-js works against the local stack.
import http from 'node:http';

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const AUTH = Number(process.env.AUTH_PORT ?? 54323);
const REST = Number(process.env.REST_PORT ?? 54324);

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
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
