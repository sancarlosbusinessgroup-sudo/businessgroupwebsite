import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Owner 2026-10-27: admins can hide an upcoming meeting from the website (migration 20261027000003_hidden_meetings.sql).

async function actAs(c: pg.Client, id: string | null) {
  await c.query(`set local role ${id ? 'authenticated' : 'anon'}`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(id ? { sub: id, role: 'authenticated' } : { role: 'anon' })]);
}

describe('hidden meetings', () => {
  it('default to shown; only admins can hide or show one; everyone can read the flag', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const m = (await c.query(`select id, hidden from meetings where category = 'Networking' and starts_at > now() order by starts_at limit 1`)).rows[0];
        expect(m).toBeTruthy();
        expect(m.hidden).toBe(false);
        await actAs(c, ids.member);
        expect((await c.query(`update meetings set hidden = true where id = $1 returning id`, [m.id])).rows).toEqual([]);
        await actAs(c, ids.admin);
        expect((await c.query(`update meetings set hidden = true where id = $1 returning hidden`, [m.id])).rows[0]?.hidden).toBe(true);
        await actAs(c, null);
        expect((await c.query(`select hidden from meetings where id = $1`, [m.id])).rows[0]?.hidden).toBe(true);
        await actAs(c, ids.admin);
        expect((await c.query(`update meetings set hidden = false where id = $1 returning hidden`, [m.id])).rows[0]?.hidden).toBe(false);
      } finally {
        await c.query('rollback');
      }
    });
  });
});
