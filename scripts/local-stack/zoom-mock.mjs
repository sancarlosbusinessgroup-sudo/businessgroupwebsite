// Stand-in for the Zoom API used by the local stack and tests (Server-to-Server OAuth + the two calls the site makes).
//   POST /oauth/token?grant_type=account_credentials&account_id=…   → a token (needs Basic auth)
//   GET  /v2/past_meetings/:id/instances                            → sessions of a meeting ID
//   GET  /v2/report/meetings/:uuid/participants                     → participant report (2 per page, to test paging)
//   GET  /v2/meetings/:id                                           → meeting details with a host start_url
//   GET  /mock/start/:id                                            → stands in for Zoom's host start page
// Test controls:
//   POST /mock/meetings  {"meetingId": "...", "instances": [{"uuid": "...", "start_time": "...", "participants": [...]}], "noReadScope": false}
//   POST /reset
import http from 'node:http';

const PORT = Number(process.env.ZOOM_MOCK_PORT ?? 54328);
const meetings = new Map(); // meetingId -> instances
const noReadScope = new Set(); // meeting IDs whose details answer 403 (app missing meeting:read:meeting:admin)
const PAGE = 2;

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
      if (req.method === 'POST' && url.pathname === '/oauth/token') {
        const auth = req.headers.authorization ?? '';
        const [id, secret] = Buffer.from(auth.replace(/^Basic /, ''), 'base64')
          .toString()
          .split(':');
        if (!id || !secret || !url.searchParams.get('account_id') || secret === 'wrong') return json(res, 400, { reason: 'Invalid client' });
        return json(res, 200, { access_token: 'mock-token', token_type: 'bearer', expires_in: 3600 });
      }
      let s = url.pathname.match(/^\/mock\/start\/([^/]+)$/);
      if (req.method === 'GET' && s) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<!doctype html><title>Zoom host start</title><h1>Mock Zoom: starting meeting ${s[1]} as host</h1>`);
      }
      if (url.pathname.startsWith('/v2/') && req.headers.authorization !== 'Bearer mock-token') return json(res, 401, { message: 'Invalid access token' });
      let m = url.pathname.match(/^\/v2\/past_meetings\/([^/]+)\/instances$/);
      if (req.method === 'GET' && m) {
        const inst = meetings.get(decodeURIComponent(m[1]));
        if (!inst) return json(res, 404, { code: 3001, message: 'Meeting does not exist' });
        return json(res, 200, { meetings: inst.map(({ uuid, start_time }) => ({ uuid, start_time })) });
      }
      m = url.pathname.match(/^\/v2\/meetings\/([^/]+)$/);
      if (req.method === 'GET' && m) {
        const id = decodeURIComponent(m[1]);
        if (!meetings.has(id)) return json(res, 404, { code: 3001, message: 'Meeting does not exist' });
        if (noReadScope.has(id)) return json(res, 403, { code: 4711, message: 'Invalid access token, does not contain scopes:[meeting:read:meeting:admin]' });
        return json(res, 200, { id: Number(id), topic: 'BARP', type: 3, start_url: `http://127.0.0.1:${PORT}/mock/start/${id}?zak=mock` });
      }
      m = url.pathname.match(/^\/v2\/report\/meetings\/(.+)\/participants$/);
      if (req.method === 'GET' && m) {
        let uuid = decodeURIComponent(m[1]);
        if (uuid.includes('%')) uuid = decodeURIComponent(uuid);
        const inst = [...meetings.values()].flat().find((i) => i.uuid === uuid);
        if (!inst) return json(res, 404, { code: 3001, message: 'Meeting does not exist' });
        const start = Number(url.searchParams.get('next_page_token') || 0);
        const page = inst.participants.slice(start, start + PAGE);
        const next = start + PAGE < inst.participants.length ? String(start + PAGE) : '';
        return json(res, 200, { participants: page, next_page_token: next, total_records: inst.participants.length });
      }
      if (req.method === 'POST' && url.pathname === '/mock/meetings') {
        meetings.set(String(body.meetingId), body.instances ?? []);
        if (body.noReadScope) noReadScope.add(String(body.meetingId));
        else noReadScope.delete(String(body.meetingId));
        return json(res, 204);
      }
      if (req.method === 'POST' && url.pathname === '/reset') {
        meetings.clear();
        noReadScope.clear();
        return json(res, 204);
      }
      json(res, 404, { message: 'not mocked' });
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`zoom mock on http://127.0.0.1:${PORT}`));
