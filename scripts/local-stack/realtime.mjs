// Minimal stand-in for Supabase Realtime (postgres_changes only), so the live activity updates can be tested end to end
// on the local stack (owner, 2026-11-25). It speaks the Phoenix websocket protocol that @supabase/realtime-js uses
// (vsn 2.0.0 JSON arrays: [join_ref, ref, topic, event, payload]) at /realtime/v1/websocket.
//
// Supabase reads row changes from the write-ahead log; this stand-in polls public.activity_versions instead (the only
// table the site listens to) and sends an UPDATE to every joined channel that asked for that table. Like RLS on the
// real service, only signed-in approved members get events. Set REALTIME_OFF=1 to test the polling fallback.
import crypto from 'node:crypto';
import pg from 'pg';

const DB_URL = process.env.REALTIME_DB_URL ?? 'postgres://postgres@127.0.0.1:54322/postgres';
const TABLE = 'activity_versions';
const COLUMNS = [
  { name: 'kind', type: 'text' },
  { name: 'version', type: 'int8' },
  { name: 'changed_at', type: 'timestamptz' },
];

function jwtClaims(token) {
  try {
    return JSON.parse(Buffer.from(String(token ?? '').split('.')[1] ?? '', 'base64url').toString());
  } catch {
    return {};
  }
}

/** Server → client text frame (unmasked). */
function frame(text) {
  const data = Buffer.from(text);
  const len = data.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, len]);
  else if (len < 65536) head = Buffer.from([0x81, 126, len >> 8, len & 255]);
  else {
    head = Buffer.alloc(10);
    head[0] = 0x81;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([head, data]);
}

/** Client → server frames (masked). Returns parsed frames and the unread rest. */
function readFrames(buf) {
  const out = [];
  let at = 0;
  while (buf.length - at >= 2) {
    const op = buf[at] & 0x0f;
    const masked = (buf[at + 1] & 0x80) !== 0;
    let len = buf[at + 1] & 0x7f;
    let p = at + 2;
    if (len === 126) {
      if (buf.length < p + 2) break;
      len = buf.readUInt16BE(p);
      p += 2;
    } else if (len === 127) {
      if (buf.length < p + 8) break;
      len = Number(buf.readBigUInt64BE(p));
      p += 8;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length < p + maskLen + len) break;
    const mask = masked ? buf.subarray(p, p + 4) : null;
    p += maskLen;
    const data = Buffer.from(buf.subarray(p, p + len));
    if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
    out.push({ op, data });
    at = p + len;
  }
  return { frames: out, rest: buf.subarray(at) };
}

export function attachRealtime(server) {
  if (process.env.REALTIME_OFF === '1') return;
  const db = new pg.Pool({ connectionString: DB_URL, max: 2 });
  db.on('error', () => {});
  /** socket -> { send, channels: Map<topic, { joinRef, ids: number[], approved: boolean }> } */
  const clients = new Set();
  let last = new Map();
  let nextId = 1;

  async function isApproved(token) {
    const c = jwtClaims(token);
    if (c.role !== 'authenticated' || !c.sub) return false;
    try {
      const { rows } = await db.query("select 1 from public.profiles where id = $1 and status = 'approved'", [c.sub]);
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  async function tick() {
    let rows;
    try {
      ({ rows } = await db.query(`select kind, version::text as version, changed_at from public.${TABLE}`));
    } catch {
      return; // table not there yet (stack still migrating)
    }
    const now = new Map(rows.map((r) => [r.kind, r]));
    const changed = rows.filter((r) => last.has(r.kind) && last.get(r.kind).version !== r.version);
    const first = last.size === 0;
    last = now;
    if (first) return;
    for (const r of changed) {
      for (const c of clients) {
        for (const [topic, ch] of c.channels) {
          if (!ch.approved || ch.ids.length === 0) continue;
          c.send([
            null,
            null,
            topic,
            'postgres_changes',
            {
              ids: ch.ids,
              data: {
                schema: 'public',
                table: TABLE,
                commit_timestamp: new Date().toISOString(),
                type: 'UPDATE',
                columns: COLUMNS,
                record: { kind: r.kind, version: r.version, changed_at: new Date(r.changed_at).toISOString() },
                old_record: { kind: r.kind },
                errors: null,
              },
            },
          ]);
        }
      }
    }
  }
  setInterval(() => void tick(), 250).unref();

  server.on('upgrade', (req, socket) => {
    if (!(req.url ?? '').startsWith('/realtime/v1/websocket')) return socket.destroy();
    const key = req.headers['sec-websocket-key'];
    if (!key) return socket.destroy();
    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const client = {
      channels: new Map(),
      send: (msg) => {
        if (!socket.destroyed) socket.write(frame(JSON.stringify(msg)));
      },
    };
    clients.add(client);
    let buf = Buffer.alloc(0);
    const close = () => {
      clients.delete(client);
      socket.destroy();
    };
    socket.on('error', close);
    socket.on('close', close);
    socket.on('data', async (chunk) => {
      const { frames, rest } = readFrames(Buffer.concat([buf, chunk]));
      buf = rest;
      for (const f of frames) {
        if (f.op === 0x8) return close();
        if (f.op === 0x9) {
          socket.write(Buffer.concat([Buffer.from([0x8a, f.data.length]), f.data]));
          continue;
        }
        if (f.op !== 0x1) continue;
        let msg;
        try {
          msg = JSON.parse(f.data.toString());
        } catch {
          continue;
        }
        const [joinRef, ref, topic, event, payload] = msg;
        if (process.env.REALTIME_DEBUG) console.log('rt in', JSON.stringify(msg).slice(0, 400));
        const reply = (response = {}, status = 'ok') => client.send([joinRef, ref, topic, 'phx_reply', { status, response }]);
        if (event === 'heartbeat') reply();
        else if (event === 'phx_join') {
          const wanted = payload?.config?.postgres_changes ?? [];
          const answered = wanted.map((w) => ({ ...w, id: nextId++ }));
          const ids = answered.filter((w) => w.table === TABLE || w.table === '*' || !w.table).map((w) => w.id);
          const approved = await isApproved(payload?.access_token);
          client.channels.set(topic, { joinRef, ids, approved });
          reply(answered.length ? { postgres_changes: answered } : {});
        } else if (event === 'access_token') {
          const ch = client.channels.get(topic);
          if (ch) ch.approved = await isApproved(payload?.access_token);
        } else if (event === 'phx_leave') {
          client.channels.delete(topic);
          reply();
        }
      }
    });
  });
}
