import { describe, expect, it } from 'vitest';
import { as, ids } from './helpers';

// Migration 20261027000002_email_change.sql: pending email changes are private to the server (owner, 2026-10-27).

describe('email change requests', () => {
  it('members cannot read or write them, not even their own', async () => {
    await as({ kind: 'user', id: ids.member }, async (q) => {
      await expect(q(`select * from email_change_requests`)).rejects.toThrow(/permission denied/);
    });
    await as({ kind: 'user', id: ids.member }, async (q) => {
      await expect(
        q(`insert into email_change_requests (profile_id, new_email, code_hash, expires_at) values ($1, 'x@example.org', repeat('a', 64), now())`, [
          ids.member,
        ]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it('admins cannot read them either; visitors have no access', async () => {
    await as({ kind: 'user', id: ids.admin }, async (q) => {
      await expect(q(`select * from email_change_requests`)).rejects.toThrow(/permission denied/);
    });
    await as({ kind: 'anon' }, async (q) => {
      await expect(q(`select * from email_change_requests`)).rejects.toThrow(/permission denied/);
    });
  });
});
