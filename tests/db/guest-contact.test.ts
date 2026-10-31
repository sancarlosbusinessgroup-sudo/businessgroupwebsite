import { describe, expect, it } from 'vitest';
import { anon, as, ids, withClient } from './helpers';

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

// Migration 20261030000002_guest_business_description.sql (owner, 2026-10-30).
describe('guest business description', () => {
  it('a visitor can describe their business (up to 1000 characters) and admins can read it back', async () => {
    const email = `describe.${Date.now()}@example.org`;
    await expect(
      as(anon, (q) =>
        q(`insert into guest_requests (first_name, last_name, email, phone, business_description) values ('Noor', 'Haddad', $1, '650-555-0100', $2)`, [
          `long.${email}`,
          'x'.repeat(1001),
        ]),
      ),
    ).rejects.toThrow(/check constraint/);
    await withClient(async (c) => {
      await c.query('begin');
      try {
        // The visitor (anon) inserts…
        await c.query(`set local role anon`);
        await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
        await c.query(
          `insert into guest_requests (first_name, last_name, email, phone, business_description) values ('Noor', 'Haddad', $1, '650-555-0100', 'Residential and commercial painting, interior and exterior.')`,
          [email],
        );
        // …and an admin reads it on the Admin page.
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        const { rows } = await c.query(`select business_description from guest_requests where email = $1`, [email]);
        expect(rows[0]?.business_description).toBe('Residential and commercial painting, interior and exterior.');
      } finally {
        await c.query('rollback');
      }
    });
  });
});
