import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261031000001_member_event_dates_visibility.sql (owner, 2026-10-31).

async function actAs(c: pg.Client, id: string | null) {
  if (id === null) {
    await c.query(`set local role anon`);
    await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    return;
  }
  await c.query(`set local role authenticated`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
}
async function tx<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  return withClient(async (c) => {
    await c.query('begin');
    try {
      return await fn(c);
    } finally {
      await c.query('rollback');
    }
  });
}
const insert = (visibility: string | null, series: string | null = null) =>
  `insert into member_events (host_id, title, starts_at, ends_at, is_online, location${visibility ? ', visibility' : ''}, series_id)
   values ('${ids.member}', 'Members mixer', now() + interval '3 days', now() + interval '3 days 1 hour', false, 'Laurel St'${
     visibility ? `, '${visibility}'` : ''
   }, ${series ? `'${series}'` : 'null'}) returning id, visibility, series_id`;

describe('member event visibility and dates', () => {
  it('events are public unless the host picks members only; visitors and pending applicants never see members-only events', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member);
      const pub = (await c.query(insert(null))).rows[0];
      const priv = (await c.query(insert('members'))).rows[0];
      expect(pub?.visibility).toBe('public');
      expect(priv?.visibility).toBe('members');

      const seen = async (who: string | null) => {
        await actAs(c, who);
        const { rows } = await c.query(`select id from member_events where id = any($1)`, [[pub?.id, priv?.id]]);
        return rows.map((r) => r.id).sort();
      };
      expect(await seen(null)).toEqual([pub?.id]);
      expect(await seen(ids.pending)).toEqual([pub?.id]);
      expect(await seen(ids.member3)).toEqual([pub?.id, priv?.id].sort());
      expect(await seen(ids.admin)).toEqual([pub?.id, priv?.id].sort());
    });
  });

  it('only "public" or "members" are allowed', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member);
      await expect(c.query(insert('friends'))).rejects.toThrow(/check constraint/);
    });
  });

  it('dates posted together share a series id', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member);
      const series = '11111111-2222-4333-8444-555555555555';
      await c.query(insert('public', series));
      await c.query(insert('public', series));
      const { rows } = await c.query(`select count(*)::int as n from member_events where series_id = $1`, [series]);
      expect(rows[0]?.n).toBe(2);
    });
  });
});
