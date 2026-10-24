import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261024000002_speaker_topic.sql: a presenter writes or changes the title of their own presentation
// on the Meetings page; it becomes the title on the slides (owner, 2026-10-24).

async function actAs(c: pg.Client, id: string) {
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

describe('presentation topics', () => {
  it('the presenter sets their own topic (even when an admin put them in the slot without one); nobody else can', async () => {
    await tx(async (c) => {
      const m = (
        await c.query(
          `select id from meetings where category = 'Networking' and starts_at > now() and cancelled_reason is null
             and id not in (select meeting_id from meeting_speakers) order by starts_at limit 1`,
        )
      ).rows[0]?.id;
      expect(m).toBeTruthy();
      // An admin assigned the slot without a topic.
      await c.query(`insert into meeting_speakers (meeting_id, slot, profile_id, display_name) values ($1, 'education', $2, 'Morgan Member')`, [m, ids.member]);

      await actAs(c, ids.member);
      await c.query(`select public.set_speaker_topic($1, 'education', 'Umbrella insurance basics', 'Why it matters')`, [m]);
      await c.query('reset role');
      const row = (await c.query(`select topic, topic_description, display_name from meeting_speakers where meeting_id = $1 and slot = 'education'`, [m])).rows[0];
      expect(row).toEqual({ topic: 'Umbrella insurance basics', topic_description: 'Why it matters', display_name: 'Morgan Member' });

      // Another member cannot change it.
      await actAs(c, ids.member3);
      await c.query('savepoint s');
      await expect(c.query(`select public.set_speaker_topic($1, 'education', 'Hijacked', null)`, [m])).rejects.toThrow(/your own/);
      await c.query('rollback to savepoint s');

      // Too short a topic is refused; an empty description clears it.
      await actAs(c, ids.member);
      await c.query('savepoint t');
      await expect(c.query(`select public.set_speaker_topic($1, 'education', 'ab', null)`, [m])).rejects.toThrow(/topic/);
      await c.query('rollback to savepoint t');
      await c.query(`select public.set_speaker_topic($1, 'education', 'Umbrella insurance 101', '')`, [m]);
      await c.query('reset role');
      const after = (await c.query(`select topic, topic_description from meeting_speakers where meeting_id = $1 and slot = 'education'`, [m])).rows[0];
      expect(after).toEqual({ topic: 'Umbrella insurance 101', topic_description: null });
    });
  });

  it('visitors cannot call it', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`set local role anon`);
        await expect(c.query(`select public.set_speaker_topic(gen_random_uuid(), 'education', 'Anything', null)`)).rejects.toThrow(/permission denied/);
      } finally {
        await c.query('rollback');
      }
    });
  });
});
