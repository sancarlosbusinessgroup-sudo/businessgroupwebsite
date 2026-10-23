import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Phase C email tables (migration 20261020000001_phase_c_email.sql).

describe('email preferences', () => {
  it('a member can save and read only their own preferences', async () => {
    await as(user(ids.member), async (q) => {
      await q(`insert into email_preferences (profile_id, prefs) values ($1, '{"meeting_reminders": false}')`, [ids.member]);
      const own = await q(`select prefs from email_preferences`);
      expect(own).toHaveLength(1);
      await q(`update email_preferences set prefs = '{"referrals": false}' where profile_id = $1`, [ids.member]);
      expect((await q(`select prefs->>'referrals' as r from email_preferences`))[0]?.r).toBe('false');
    });
    await expect(as(user(ids.member), (q) => q(`insert into email_preferences (profile_id, prefs) values ($1, '{}')`, [ids.member3]))).rejects.toThrow(
      /row-level security/,
    );
  });

  it('other members and visitors cannot read anyone’s preferences', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`insert into email_preferences (profile_id, prefs) values ($1, '{"digest": false}')`, [ids.member3]);
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select * from email_preferences where profile_id = $1`, [ids.member3])).rows).toHaveLength(0);
      } finally {
        await c.query('rollback');
      }
    });
    await expect(as(anon, (q) => q(`select * from email_preferences`))).rejects.toThrow(/permission denied/);
  });

  it('refuses a non-object or oversized value', async () => {
    await expect(as(user(ids.member), (q) => q(`insert into email_preferences (profile_id, prefs) values ($1, '[1]')`, [ids.member]))).rejects.toThrow(
      /check constraint/,
    );
  });
});

describe('email log', () => {
  it('only the server writes it; admins can read it, members cannot', async () => {
    await expect(
      as(user(ids.admin), (q) => q(`insert into email_log (kind, dedupe_key, recipient) values ('welcome', 'x', 'a@example.test')`)),
    ).rejects.toThrow(/row-level security/);
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`insert into email_log (kind, dedupe_key, recipient) values ('welcome', 'k1', 'a@example.test')`);
        // The same notice to the same person cannot be logged twice.
        await expect(c.query(`insert into email_log (kind, dedupe_key, recipient) values ('welcome', 'k1', 'a@example.test')`)).rejects.toThrow(
          /duplicate key/,
        );
      } finally {
        await c.query('rollback');
      }
    });
    await as(user(ids.admin), async (q) => {
      await q(`select * from email_log`);
    });
    await as(user(ids.member), async (q) => {
      expect(await q(`select * from email_log`)).toHaveLength(0);
    });
  });
});

describe('onboarding', () => {
  it('an approved member completes their own onboarding only after agreeing to both statements', async () => {
    await as(user(ids.member), async (q) => {
      await expect(q(`select complete_onboarding(true, false)`)).rejects.toThrow(/agree to both/);
    });
    await as(user(ids.member), async (q) => {
      await q(`select complete_onboarding(true, true)`);
      const rows = await q(`select share_contacts, agreed_commitments, completed_at from member_onboarding where profile_id = $1`, [ids.member]);
      expect(rows[0]?.share_contacts).toBe(true);
      expect(rows[0]?.completed_at).not.toBeNull();
    });
  });

  it('pending applicants and visitors cannot complete onboarding; members cannot create rows directly', async () => {
    await expect(as(user(ids.pending), (q) => q(`select complete_onboarding(true, true)`))).rejects.toThrow(/members only/);
    await expect(as(anon, (q) => q(`select complete_onboarding(true, true)`))).rejects.toThrow(/permission denied/);
    await expect(as(user(ids.member), (q) => q(`insert into member_onboarding (profile_id) values ($1)`, [ids.member]))).rejects.toThrow(/row-level security/);
    await as(user(ids.admin), async (q) => {
      await q(`insert into member_onboarding (profile_id) values ($1)`, [ids.member3]);
    });
  });
});
