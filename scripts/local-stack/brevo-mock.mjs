// Stand-in for the Brevo API (https://api.brevo.com/v3) used by the local stack and tests.
// Accepts transactional emails and contact calls and keeps them in memory:
//   GET  /emails?to=<email>   → sent emails (newest last)
//   GET  /contacts            → contact upserts / list changes
//   POST /reset               → clear both (and stop failing)
//   POST /fail {count}        → the next <count> emails are refused with 401 "Key not found", like a bad API key
import http from 'node:http';

const PORT = Number(process.env.BREVO_MOCK_PORT ?? 54327);
const emails = [];
const contacts = [];
let failNext = 0;

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://x');
      const body = raw ? JSON.parse(raw) : null;
      if (req.method === 'POST' && url.pathname === '/v3/smtp/email') {
        if (!req.headers['api-key']) return json(res, 401, { message: 'missing api-key' });
        if (failNext > 0) {
          failNext--;
          return json(res, 401, { message: 'Key not found', code: 'unauthorized' });
        }
        emails.push({ ...body, at: Date.now() });
        if (emails.length > 500) emails.shift();
        return json(res, 201, { messageId: `<mock-${emails.length}@brevo>` });
      }
      if (url.pathname.startsWith('/v3/contacts')) {
        contacts.push({ method: req.method, path: url.pathname, body, at: Date.now() });
        return json(res, req.method === 'POST' ? 201 : 204, req.method === 'POST' ? { id: contacts.length } : undefined);
      }
      if (req.method === 'GET' && url.pathname === '/emails') {
        const to = url.searchParams.get('to')?.toLowerCase();
        return json(res, 200, to ? emails.filter((e) => (e.to ?? []).some((t) => t.email.toLowerCase() === to)) : emails);
      }
      if (req.method === 'GET' && url.pathname === '/contacts') return json(res, 200, contacts);
      if (req.method === 'POST' && url.pathname === '/reset') {
        emails.length = 0;
        contacts.length = 0;
        failNext = 0;
        return json(res, 204);
      }
      if (req.method === 'POST' && url.pathname === '/fail') {
        failNext = Number(body?.count ?? 1);
        return json(res, 204);
      }
      json(res, 404, { message: 'not mocked' });
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`brevo mock on http://127.0.0.1:${PORT}`));
