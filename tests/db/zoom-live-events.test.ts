import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import { anon, as, ids, user, withClient } from './helpers';

/** Runs a statement that must fail, without aborting the surrounding transaction. */
async function fails(c: pg.Client, sql: string, params: unknown[], pattern: RegExp) {
  await c.query('savepoint s');
  await expect(c.query(sql, params)).rejects.toThrow(pattern);
  await c.query('rollback to savepoint s');
}

// Migration 20261110000002_zoom_live_events.sql (live attendance, owner 2026-11-10).

describe('zoom_live_events', () => {
  it('only the server writes; admins read; members and visitors see nothing; duplicates are refused', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const m = (await c.query(`select id from meetings order by starts_at desc limit 1`)).rows[0].id as string;
        // The webhook writes with the service role (bypasses RLS), like this test's superuser connection.
        await c.query(`insert into zoom_live_events (meeting_id, event, key, name, at) values ($1, 'joined', 'name:iphone', 'iPhone', now())`, [m]);
        await fails(
          c,
          `insert into zoom_live_events (meeting_id, event, key, name, at) select meeting_id, event, key, name, at from zoom_live_events`,
          [],
          /duplicate key/,
        );
        await fails(c, `insert into zoom_live_events (meeting_id, event, key, name, at) values ($1, 'waiting', 'k', 'n', now())`, [m], /check constraint/);

        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        expect((await c.query(`select name from zoom_live_events where meeting_id = $1`, [m])).rows).toEqual([{ name: 'iPhone' }]);
        await fails(c, `insert into zoom_live_events (meeting_id, event, key, name, at) values ($1, 'left', 'k', 'n', now())`, [m], /permission denied/);

        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select * from zoom_live_events`)).rows).toHaveLength(0);
      } finally {
        await c.query('rollback');
      }
    });
    await expect(as(anon, (q) => q(`select * from zoom_live_events`))).rejects.toThrow(/permission denied/);
    await expect(as(user(ids.pending), (q) => q(`select * from zoom_live_events`))).resolves.toHaveLength(0);
  });
});
