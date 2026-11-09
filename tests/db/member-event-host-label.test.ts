import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261109000001_member_event_host_label.sql (owner, 2026-11-09): the displayed "Hosted by" name can differ
// from the poster's name; `host_id` still says who posted the event.

async function tx<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  return withClient(async (c) => {
    await c.query('begin');
    try {
      await c.query(`set local role authenticated`);
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
      return await fn(c);
    } finally {
      await c.query('rollback');
    }
  });
}

const insert = `insert into member_events (host_id, title, starts_at, ends_at, is_online, location, host_label)
  values ('${ids.member}', 'Open house', now() + interval '3 days', now() + interval '3 days 1 hour', false, 'Laurel St', $1)
  returning host_id, host_label`;

describe('member event "Hosted by" label', () => {
  it('is empty by default and otherwise 2–80 characters; the poster stays the host', async () => {
    await tx(async (c) => {
      expect((await c.query(insert, [null])).rows[0]).toEqual({ host_id: ids.member, host_label: null });
      expect((await c.query(insert, ['Acme Realty'])).rows[0]).toEqual({ host_id: ids.member, host_label: 'Acme Realty' });
      for (const bad of ['A', ' ', 'x'.repeat(81)]) {
        await c.query('savepoint s');
        await expect(c.query(insert, [bad])).rejects.toThrow(/host_label_check/);
        await c.query('rollback to savepoint s');
      }
    });
  });
});
