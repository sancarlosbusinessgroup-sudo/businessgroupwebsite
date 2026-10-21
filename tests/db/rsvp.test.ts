import { describe, expect, it } from 'vitest';
import { as, ids, user, withClient } from './helpers';

// Migration 20261021000002_rsvp_attending.sql.

async function aMeeting(): Promise<string> {
  return withClient(async (c) => (await c.query(`select id from meetings order by starts_at limit 1`)).rows[0].id as string);
}

describe('RSVP answers', () => {
  it('a member answers "can attend", switches to "can\'t attend", and cannot change someone else\'s answer', async () => {
    const m = await aMeeting();
    await as(user(ids.member), async (q) => {
      await q(`insert into rsvps (meeting_id, profile_id) values ($1, $2)`, [m, ids.member]);
      const [row] = await q(`select attending from rsvps where meeting_id = $1 and profile_id = $2`, [m, ids.member]);
      expect(row?.attending).toBe(true);
      await q(`update rsvps set attending = false where meeting_id = $1 and profile_id = $2`, [m, ids.member]);
      const [after] = await q(`select attending from rsvps where meeting_id = $1 and profile_id = $2`, [m, ids.member]);
      expect(after?.attending).toBe(false);
    });
    await as(user(ids.admin), async (q) => {
      await q(`insert into rsvps (meeting_id, profile_id, attending) values ($1, $2, true)`, [m, ids.admin]);
    });
    const changed = await as(user(ids.member), (q) => q(`update rsvps set attending = false where profile_id = $1 returning 1`, [ids.admin]));
    expect(changed).toHaveLength(0);
  });
});
