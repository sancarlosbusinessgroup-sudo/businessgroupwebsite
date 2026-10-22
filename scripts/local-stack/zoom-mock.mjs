// Stand-in for the Zoom API used by the local stack and tests (Server-to-Server OAuth + the two calls the site makes).
//   POST /oauth/token?grant_type=account_credentials&account_id=…   → a token (needs Basic auth)
//   GET  /v2/past_meetings/:id/instances                            → sessions of a meeting ID
//   GET  /v2/report/meetings/:uuid/participants                     → participant report (2 per page, to test paging)
// Test controls:
//   POST /mock/meetings  {"meetingId": "...", "instances": [{"uuid": "...", "start_time": "...", "participants": [...]}]}
//   POST /reset
import http from 'node:http';

const PORT = Number(process.env.ZOOM_MOCK_PORT ?? 54328);
const meetings = new Map(); // meetingId -> instances
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
      if (url.pathname.startsWith('/v2/') && req.headers.authorization !== 'Bearer mock-token') return json(res, 401, { message: 'Invalid access token' });
      let m = url.pathname.match(/^\/v2\/past_meetings\/([^/]+)\/instances$/);
      if (req.method === 'GET' && m) {
        const inst = meetings.get(decodeURIComponent(m[1]));
        if (!inst) return json(res, 404, { code: 3001, message: 'Meeting does not exist' });
        return json(res, 200, { meetings: inst.map(({ uuid, start_time }) => ({ uuid, start_time })) });
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
        return json(res, 204);
      }
      if (req.method === 'POST' && url.pathname === '/reset') {
        meetings.clear();
        return json(res, 204);
      }
      json(res, 404, { message: 'not mocked' });
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`zoom mock on http://127.0.0.1:${PORT}`));
