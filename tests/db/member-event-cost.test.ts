import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261103000001_member_event_cost.sql (owner, 2026-11-03): free or paid, price and where to pay.

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

const insert = `insert into member_events (host_id, title, starts_at, ends_at, is_online, location, is_paid, price, payment_url, payment_info)
  values ('${ids.member}', 'Wine tasting', now() + interval '3 days', now() + interval '3 days 1 hour', false, 'Laurel St', $1, $2, $3, $4)
  returning is_paid, price, payment_url, payment_info`;

describe('member event cost', () => {
  it('events are free unless the host says paid', async () => {
    await tx(async (c) => {
      const { rows } = await c.query(
        `insert into member_events (host_id, title, starts_at, ends_at, is_online, location)
         values ('${ids.member}', 'Coffee', now() + interval '3 days', now() + interval '3 days 1 hour', false, 'Laurel St') returning is_paid, price`,
      );
      expect(rows[0]).toEqual({ is_paid: false, price: null });
    });
  });

  it('a paid event has a price and a payment link and/or instructions', async () => {
    await tx(async (c) => {
      expect((await c.query(insert, [true, '$25', 'https://pay.example.com/e/1', null])).rows[0]).toMatchObject({ is_paid: true, price: '$25' });
      expect((await c.query(insert, [true, '$20', null, 'Pay at the door'])).rows[0]).toMatchObject({ payment_info: 'Pay at the door' });
      for (const bad of [
        [true, null, 'https://pay.example.com', null], // no price
        [true, '$25', null, null], // nowhere to pay
        [true, '$25', 'http://pay.example.com', null], // not https
        [false, '$25', null, null], // free with a price
      ]) {
        await c.query('savepoint s');
        await expect(c.query(insert, bad)).rejects.toThrow(/check constraint/);
        await c.query('rollback to savepoint s');
      }
    });
  });
});
