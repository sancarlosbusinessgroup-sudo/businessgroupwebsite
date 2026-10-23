import { describe, expect, it } from 'vitest';
import { anon, as } from './helpers';

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
});
