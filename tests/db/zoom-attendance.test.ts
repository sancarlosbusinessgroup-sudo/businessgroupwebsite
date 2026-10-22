import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Migration 20261023000001_zoom_attendance.sql (Phase D).

async function aPastMeeting(): Promise<string> {
  return withClient(async (c) => (await c.query(`select id from meetings where starts_at < now() order by starts_at desc limit 1`)).rows[0].id as string);
}

describe('zoom attendance tables', () => {
  it('admins record imports, participants and aliases; members only see which meetings were taken; visitors see nothing', async () => {
    const m = await aPastMeeting();
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin, role: 'authenticated' })]);
        await c.query(`insert into attendance_imports (meeting_id, source, participants, matched) values ($1, 'zoom', 3, 2)`, [m]);
        await c.query(`insert into zoom_participants (meeting_id, key, name, email, minutes) values ($1, 'name:iphone', 'iPhone', null, 60)`, [m]);
        await c.query(`insert into zoom_aliases (key, profile_id) values ('name:iphone', $1)`, [ids.member]);
        await c.query(
          `insert into attendance (meeting_id, profile_id, status, zoom, joined_at, left_at, minutes) values ($1, $2, 'present', true, now() - interval '1 hour', now(), 60)
           on conflict (meeting_id, profile_id) do update set zoom = true, minutes = 60`,
          [m, ids.member],
        );

        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select meeting_id from attendance_imports where meeting_id = $1`, [m])).rows).toHaveLength(1);
        expect((await c.query(`select * from zoom_participants`)).rows).toHaveLength(0);
        expect((await c.query(`select * from zoom_aliases`)).rows).toHaveLength(0);
        // A member sees their own Zoom minutes.
        expect((await c.query(`select minutes, zoom from attendance where meeting_id = $1 and profile_id = $2`, [m, ids.member])).rows[0]).toEqual({
          minutes: 60,
          zoom: true,
        });
        expect((await c.query(`update attendance_imports set matched = 99 returning meeting_id`)).rows).toHaveLength(0);
        await expect(c.query(`insert into zoom_aliases (key, profile_id) values ('name:me', $1)`, [ids.member])).rejects.toThrow(/row-level security/);
      } finally {
        await c.query('rollback');
      }
    });
    await expect(as(anon, (q) => q(`select * from attendance_imports`))).rejects.toThrow(/permission denied/);
    await expect(as(anon, (q) => q(`select * from zoom_participants`))).rejects.toThrow(/permission denied/);
    await expect(as(user(ids.pending), (q) => q(`select * from attendance_imports`))).resolves.toHaveLength(0);
  });

  it('only accepts known values', async () => {
    const m = await aPastMeeting();
    await expect(as(user(ids.admin), (q) => q(`insert into attendance_imports (meeting_id, source) values ($1, 'email')`, [m]))).rejects.toThrow(
      /check constraint/,
    );
    await expect(
      as(user(ids.admin), (q) => q(`insert into zoom_participants (meeting_id, key, name, resolution) values ($1, 'k', 'n', 'maybe')`, [m])),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(user(ids.admin), (q) => q(`insert into zoom_participants (meeting_id, key, name, minutes) values ($1, 'k', 'n', 5000)`, [m])),
    ).rejects.toThrow(/check constraint/);
  });
});
