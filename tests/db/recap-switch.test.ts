import { describe, expect, it } from 'vitest';
import { as, ids } from './helpers';

// Migration 20261026000001_recap_switch.sql: admins turn the automatic meeting recap email on or off (owner, 2026-10-26).

describe('meeting recap switch', () => {
  it('is on by default; admins can read and change it', async () => {
    await as({ kind: 'user', id: ids.admin }, async (q) => {
      expect(await q(`select meeting_recaps_enabled from email_settings`)).toEqual([{ meeting_recaps_enabled: true }]);
      await q(`update email_settings set meeting_recaps_enabled = false, updated_by = $1, updated_at = now() where id = 1`, [ids.admin]);
      expect(await q(`select meeting_recaps_enabled from email_settings`)).toEqual([{ meeting_recaps_enabled: false }]);
    });
  });

  it('members cannot see or change it', async () => {
    await as({ kind: 'user', id: ids.member }, async (q) => {
      expect(await q(`select * from email_settings`)).toEqual([]);
      expect(await q(`update email_settings set meeting_recaps_enabled = false where id = 1 returning id`)).toEqual([]);
    });
  });

  it('visitors have no access', async () => {
    await as({ kind: 'anon' }, async (q) => {
      await expect(q(`select * from email_settings`)).rejects.toThrow(/permission denied/);
    });
  });

  it('only one settings row can exist', async () => {
    await as({ kind: 'user', id: ids.admin }, async (q) => {
      await expect(q(`insert into email_settings (id) values (2)`)).rejects.toThrow();
    });
  });
});
