import { describe, expect, it } from 'vitest';
import { anon, as, ids, user } from './helpers';

// Migration 20261123000001_meeting_champions.sql (owner, 2026-11-23): a BARP Champion per meeting. Anyone may read who won
// (the badge is public); only admins write. The site records the automatic pick with the service role.

const newMeeting = `insert into meetings (slug, title, category, starts_at, ends_at)
  values ('champ-db-' || gen_random_uuid(), 'Champion DB test', 'Networking', now() - interval '2 days', now() - interval '2 days' + interval '75 minutes')
  returning id`;

describe('meeting_champions', () => {
  it('admins record and change a meeting champion; members cannot; everyone can read', async () => {
    await as(user(ids.admin), async (q) => {
      const [m] = await q(newMeeting);
      const meetingId = m!.id as string;
      await q(
        `insert into meeting_champions (meeting_id, profile_id, auto_profile_id, points, period_to) values ($1, $2, $2, '{"points": 3}', now() - interval '2 days')`,
        [meetingId, ids.member],
      );
      await q(`update meeting_champions set profile_id = $2, reason = 'Brought three visitors' where meeting_id = $1`, [meetingId, ids.admin]);
      expect(await q(`select profile_id, auto_profile_id, reason from meeting_champions where meeting_id = $1`, [meetingId])).toEqual([
        { profile_id: ids.admin, auto_profile_id: ids.member, reason: 'Brought three visitors' },
      ]);
    });
  });

  it('members cannot write, anonymous visitors can read', async () => {
    await as(user(ids.member), async (q) => {
      const [m] = await q(`select id from meetings limit 1`);
      await expect(q(`insert into meeting_champions (meeting_id, profile_id, period_to) values ($1, $2, now())`, [m!.id, ids.member])).rejects.toThrow(
        /row-level security/,
      );
    });
    await as(anon, async (q) => {
      expect(Array.isArray(await q(`select meeting_id, profile_id from meeting_champions`))).toBe(true);
    });
  });
});
