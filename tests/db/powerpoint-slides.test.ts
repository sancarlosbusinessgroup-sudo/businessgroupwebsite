import { describe, expect, it } from 'vitest';
import { as, ids, user, withClient } from './helpers';

// Migration 20261027000001_powerpoint_slides.sql: PowerPoint files as presenter materials (owner, 2026-10-27).

async function aMeeting(): Promise<string> {
  return withClient(async (c) => (await c.query(`select id from meetings order by starts_at limit 1`)).rows[0].id as string);
}

describe('PowerPoint presenter materials', () => {
  it('admins can add a PowerPoint file; it needs a stored file and no page count or YouTube id', async () => {
    const m = await aMeeting();
    await as(user(ids.admin), async (q) => {
      const rows = await q(
        `insert into meeting_slide_media (meeting_id, kind, storage_path, after_slide) values ($1, 'powerpoint', $2, 'five_minute') returning kind`,
        [m, `${m}/deck.pptx`],
      );
      expect(rows).toEqual([{ kind: 'powerpoint' }]);
    });
    for (const vals of [`null, null`, `'x/deck.pptx', 3`])
      await expect(
        as(user(ids.admin), (q) =>
          q(`insert into meeting_slide_media (meeting_id, kind, storage_path, page_count, after_slide) values ($1, 'powerpoint', ${vals}, 'five_minute')`, [m]),
        ),
      ).rejects.toThrow(/check constraint|violates/);
  });

  it('members still cannot add slide materials', async () => {
    const m = await aMeeting();
    await expect(
      as(user(ids.member), (q) =>
        q(`insert into meeting_slide_media (meeting_id, kind, storage_path, after_slide) values ($1, 'powerpoint', 'x/deck.pptx', 'ten_minute')`, [m]),
      ),
    ).rejects.toThrow(/row-level security|permission/);
  });

  it('the slide-media bucket accepts .ppt and .pptx files and stays private', async () => {
    const [b] = await withClient(async (c) => (await c.query(`select public, allowed_mime_types from storage.buckets where id = 'slide-media'`)).rows);
    expect(b?.public).toBe(false);
    expect(b?.allowed_mime_types).toEqual(
      expect.arrayContaining(['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
    );
  });
});
