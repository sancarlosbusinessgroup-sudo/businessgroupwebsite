import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261024000003_one_on_one_reply.sql: the invitee can Accept, Decline or Send a message (owner, 2026-10-24).

async function actAs(c: pg.Client, id: string) {
  await c.query(`set local role authenticated`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
}

describe('one-on-one request messages', () => {
  it('the invitee sends a message (the request stays open), the requester reads it; nobody else can send one', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await actAs(c, ids.member);
        const { rows } = await c.query(`insert into one_on_one_requests (requester_id, invitee_id, message) values ($1, $2, 'Coffee?') returning id`, [
          ids.member,
          ids.member3,
        ]);
        const id = rows[0]?.id;

        // The requester cannot answer their own request with a message.
        await c.query('savepoint a');
        await expect(c.query(`select public.reply_one_on_one_request($1, 'Hi')`, [id])).rejects.toThrow(/not allowed/);
        await c.query('rollback to savepoint a');

        await actAs(c, ids.member3);
        await c.query('savepoint b');
        await expect(c.query(`select public.reply_one_on_one_request($1, '   ')`, [id])).rejects.toThrow(/up to 500/);
        await c.query('rollback to savepoint b');
        await c.query(`select public.reply_one_on_one_request($1, '  I''m travelling until the 10th, sorry!  ')`, [id]);
        // Members cannot write the reply columns directly.
        expect((await c.query(`update one_on_one_requests set reply = 'forged' where id = $1 returning id`, [id])).rows).toEqual([]);

        await actAs(c, ids.member);
        const [r] = (await c.query(`select status, reply, replied_at is not null as replied from one_on_one_requests where id = $1`, [id])).rows;
        expect(r).toEqual({ status: 'pending', reply: "I'm travelling until the 10th, sorry!", replied: true });

        // After declining, no more messages.
        await actAs(c, ids.member3);
        await c.query(`select public.respond_one_on_one_request($1, 'declined')`, [id]);
        await c.query('savepoint c');
        await expect(c.query(`select public.reply_one_on_one_request($1, 'One more thing')`, [id])).rejects.toThrow(/already answered/);
        await c.query('rollback to savepoint c');
      } finally {
        await c.query('rollback');
      }
    });
  });

  it('visitors cannot call it', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`set local role anon`);
        await expect(c.query(`select public.reply_one_on_one_request(gen_random_uuid(), 'Hi')`)).rejects.toThrow(/permission denied/);
      } finally {
        await c.query('rollback');
      }
    });
  });
});
