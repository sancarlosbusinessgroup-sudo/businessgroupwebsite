import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Migration 20261101000001_meeting_followups.sql (owner meeting 2026-10-30, asked for 2026-11-01).

describe('second business name and birthdays', () => {
  it('members set their own; visitors read the second business name but never the birthday', async () => {
    await as(user(ids.member), async (q) => {
      await q(`update profiles set second_business_name = 'Fedora Fiduciary', birthday_month = 2, birthday_day = 29 where id = $1`, [ids.member]);
      const [me] = await q(`select second_business_name, birthday_month, birthday_day from profiles where id = $1`, [ids.member]);
      expect(me).toEqual({ second_business_name: 'Fedora Fiduciary', birthday_month: 2, birthday_day: 29 });
      // Another member sees the birthday (for the slide) too.
    });
    await as(anon, async (q) => {
      const [p] = await q(`select second_business_name from profiles where id = $1`, [ids.member]);
      expect(p).toHaveProperty('second_business_name');
      await expect(q(`select birthday_month from profiles where id = $1`, [ids.member])).rejects.toThrow(/permission denied/);
    });
  });

  it('month and day go together and must be in range', async () => {
    await as(user(ids.member), async (q) => {
      await expect(q(`update profiles set birthday_month = 5, birthday_day = null where id = $1`, [ids.member])).rejects.toThrow(/profiles_birthday_both/);
    });
    await as(user(ids.member), async (q) => {
      await expect(q(`update profiles set birthday_month = 13, birthday_day = 1 where id = $1`, [ids.member])).rejects.toThrow(/check/);
    });
    await as(user(ids.member), async (q) => {
      await expect(q(`update profiles set second_business_name = '' where id = $1`, [ids.member])).rejects.toThrow(/check/);
    });
  });
});

describe('guest surveys', () => {
  it('only admins read answers; nobody but the server writes them', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const [g] = (
          await c.query(`insert into guest_requests (first_name, last_name, email) values ('Sam', 'Survey', 'sam.survey.db@example.test') returning id`)
        ).rows;
        await c.query(`insert into guest_surveys (guest_id, token, coming_back) values ($1, $2, 'yes')`, [g.id, 'x'.repeat(32)]);
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select * from guest_surveys`)).rows).toHaveLength(0);
        // A refused statement aborts the transaction, so each runs inside a savepoint.
        const refused = async (sql: string, params: unknown[]) => {
          await c.query('savepoint s');
          await expect(c.query(sql, params)).rejects.toThrow(/permission denied/);
          await c.query('rollback to savepoint s');
        };
        await refused(`insert into guest_surveys (guest_id, token) values ($1, $2)`, [g.id, 'y'.repeat(32)]);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        const rows = (await c.query(`select coming_back from guest_surveys where guest_id = $1`, [g.id])).rows;
        expect(rows).toEqual([{ coming_back: 'yes' }]);
        await refused(`update guest_surveys set comments = 'edited' where guest_id = $1`, [g.id]);
      } finally {
        await c.query('rollback');
      }
    });
    await as(anon, async (q) => {
      await expect(q(`select * from guest_surveys`)).rejects.toThrow(/permission denied/);
    });
  });
});
