// Minimal SMTP server that accepts every message and keeps the last 100 in memory.
// GET http://127.0.0.1:54326/messages?to=<email> returns them as JSON so tests can
// read confirmation links and one-time codes.
import net from 'node:net';
import http from 'node:http';

const SMTP_PORT = Number(process.env.SMTP_PORT ?? 54325);
const API_PORT = Number(process.env.MAIL_API_PORT ?? 54326);
const messages = [];

function decodeQuotedPrintable(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

net
  .createServer((sock) => {
    let mode = 'cmd';
    let buf = '';
    let current = { to: [], data: '' };
    sock.write('220 local-smtp ready\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      while (true) {
        if (mode === 'data') {
          const end = buf.indexOf('\r\n.\r\n');
          if (end === -1) return;
          current.data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          const body = decodeQuotedPrintable(current.data);
          const subject = (body.match(/^Subject: (.*)$/m) ?? [])[1] ?? '';
          messages.push({ to: current.to, subject, body, at: Date.now() });
          if (messages.length > 100) messages.shift();
          current = { to: [], data: '' };
          mode = 'cmd';
          sock.write('250 OK\r\n');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl === -1) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250 local-smtp\r\n');
        else if (cmd === 'MAIL') sock.write('250 OK\r\n');
        else if (cmd === 'RCPT') {
          const m = line.match(/<([^>]+)>/);
          if (m) current.to.push(m[1].toLowerCase());
          sock.write('250 OK\r\n');
        } else if (cmd === 'DATA') {
          mode = 'data';
          sock.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (cmd === 'QUIT') {
          sock.end('221 Bye\r\n');
          return;
        } else sock.write('250 OK\r\n');
      }
    });
    sock.on('error', () => {});
  })
  .listen(SMTP_PORT, '127.0.0.1');

http
  .createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    if (u.pathname === '/templates/magic-link') {
      // Same content we recommend for the hosted Supabase "Magic Link" template (see README).
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(
        '<h2>Your SCBNG sign-in code</h2><p>Your code is: <strong>{{ .Token }}</strong></p><p>Or <a href="{{ .ConfirmationURL }}">log in with this link</a>.</p>',
      );
      return;
    }
    if (req.method === 'DELETE') {
      messages.length = 0;
      res.end('[]');
      return;
    }
    const to = u.searchParams.get('to')?.toLowerCase();
    const list = to ? messages.filter((m) => m.to.includes(to)) : messages;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(list));
  })
  .listen(API_PORT, '127.0.0.1');

console.log(`smtp sink on ${SMTP_PORT}, api on ${API_PORT}`);
