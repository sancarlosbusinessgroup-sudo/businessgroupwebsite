import { describe, expect, it } from 'vitest';
import { anon, as, withClient } from './helpers';

// Migration 20261024000001_guest_phone_website.sql.

describe('guest phone and website', () => {
  it('a visitor can leave a phone and website; a website must be a web address', async () => {
    const email = `contact.${Date.now()}@example.org`;
    await as(anon, (q) =>
      q(`insert into guest_requests (first_name, last_name, email, phone, website) values ('Jen', 'McKay', $1, '520-429-6654', 'https://www.example.org')`, [
        email,
      ]),
    );
    await expect(
      as(anon, (q) =>
        q(`insert into guest_requests (first_name, last_name, email, website) values ('Jen', 'McKay', $1, 'javascript:alert(1)')`, [`x.${email}`]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('a new guest request never arrives with its one-on-ones already marked done (only admins mark it later)', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const { rows } = await c.query(
          `insert into guest_requests (first_name, last_name, email, phone, one_on_ones_done_at) values ('Sam', 'Self', $1, '650-555-0100', now()) returning id, one_on_ones_done_at`,
          [`selfmark.${Date.now()}@example.org`],
        );
        expect(rows[0]?.one_on_ones_done_at).toBeNull();
        // An update (what admins do) keeps the mark.
        const upd = await c.query(`update guest_requests set one_on_ones_done_at = now() where id = $1 returning one_on_ones_done_at`, [rows[0]?.id]);
        expect(upd.rows[0]?.one_on_ones_done_at).not.toBeNull();
      } finally {
        await c.query('rollback');
      }
    });
  });
});
