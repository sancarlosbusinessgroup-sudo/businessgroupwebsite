import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Migration 20261021000001_slides_media_application.sql.

async function aMeeting(): Promise<string> {
  return withClient(async (c) => (await c.query(`select id from meetings order by starts_at limit 1`)).rows[0].id as string);
}

describe('slide order', () => {
  it('accepts the new agenda slide names and the old ones; refuses anything that is not a slide name', async () => {
    const m = await aMeeting();
    await as(user(ids.admin), async (q) => {
      await q(`insert into meeting_slide_settings (meeting_id, slides) values ($1, array['welcome','agenda','call_to_order','five_qa','phones'])`, [m]);
    });
    await expect(
      as(user(ids.admin), (q) => q(`insert into meeting_slide_settings (meeting_id, slides) values ($1, array['welcome','<script>'])`, [m])),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('added slides (images, PDFs, YouTube)', () => {
  it('admins add them; members can read them; members cannot add, change or remove them', async () => {
    const m = await aMeeting();
    await as(user(ids.admin), async (q) => {
      const [yt] = await q(
        `insert into meeting_slide_media (meeting_id, kind, youtube_id, start_seconds, after_slide, title) values ($1, 'youtube', 'dQw4w9WgXcQ', 30, 'announcements', 'Video') returning id, created_by`,
        [m],
      );
      expect(yt?.created_by).toBe(ids.admin);
      await q(`insert into meeting_slide_media (meeting_id, kind, storage_path, page_count, after_slide) values ($1, 'pdf', $2, 3, 'ten_minute')`, [m, `${m}/a.pdf`]);
    });
    await expect(
      as(user(ids.member), (q) => q(`insert into meeting_slide_media (meeting_id, kind, youtube_id, after_slide) values ($1, 'youtube', 'dQw4w9WgXcQ', 'welcome')`, [m])),
    ).rejects.toThrow(/row-level security/);
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`insert into meeting_slide_media (meeting_id, kind, youtube_id, after_slide) values ($1, 'youtube', 'dQw4w9WgXcQ', 'welcome')`, [m]);
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select * from meeting_slide_media`)).rows.length).toBeGreaterThan(0);
        expect((await c.query(`delete from meeting_slide_media returning id`)).rows).toHaveLength(0);
        expect((await c.query(`update meeting_slide_media set title = 'x' returning id`)).rows).toHaveLength(0);
      } finally {
        await c.query('rollback');
      }
    });
    await expect(as(anon, (q) => q(`select * from meeting_slide_media`))).rejects.toThrow(/permission denied/);
    await expect(as(user(ids.pending), (q) => q(`select * from meeting_slide_media`))).resolves.toHaveLength(0);
  });

  it('each kind needs the right details', async () => {
    const m = await aMeeting();
    const bad = [
      [`'youtube', null, 'not-an-id', null`],
      [`'youtube', 'x/y.png', 'dQw4w9WgXcQ', null`],
      [`'pdf', 'x/y.pdf', null, null`],
      [`'image', null, null, null`],
      [`'image', 'x/y.png', null, 2`],
    ];
    for (const [vals] of bad)
      await expect(
        as(user(ids.admin), (q) => q(`insert into meeting_slide_media (meeting_id, kind, storage_path, youtube_id, page_count, after_slide) values ($1, ${vals}, 'welcome')`, [m])),
      ).rejects.toThrow(/check constraint|violates/);
  });

  it('the private slide-media bucket exists, up to 20 MB, images and PDFs only', async () => {
    const [b] = await withClient(async (c) => (await c.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'slide-media'`)).rows);
    expect(b).toMatchObject({ public: false, file_size_limit: '20971520' });
    expect(b?.allowed_mime_types).toContain('application/pdf');
  });
});

describe('application form', () => {
  it('stores each reference’s business name', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const meta = {
          first_name: 'Rena',
          last_name: 'Refs',
          business_name: 'Refs Co',
          application: {
            years_in_business: '3 years',
            product_service: 'Things',
            signature_name: 'Rena Refs',
            references: [{ name: 'A', business: 'Accountant', business_name: 'A Accounting', phone: '6505550100' }],
          },
        };
        const { rows } = await c.query(
          `insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'rena.refs@example.test', $1) returning id`,
          [JSON.stringify(meta)],
        );
        const app = (await c.query(`select "references" from member_applications where profile_id = $1`, [rows[0].id])).rows[0];
        expect(app.references[0]).toMatchObject({ business: 'Accountant', business_name: 'A Accounting' });
      } finally {
        await c.query('rollback');
      }
    });
  });
});

describe('website links on slides', () => {
  it('admins add https links; members read them; members cannot add; visitors see nothing; only https is stored', async () => {
    const m = await aMeeting();
    await as(user(ids.admin), async (q) => {
      await q(`insert into meeting_slide_links (meeting_id, url, after_slide) values ($1, 'https://example.com/video?id=1', 'five_minute')`, [m]);
    });
    await expect(
      as(user(ids.admin), (q) => q(`insert into meeting_slide_links (meeting_id, url, after_slide) values ($1, 'http://example.com', 'five_minute')`, [m])),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(user(ids.admin), (q) => q(`insert into meeting_slide_links (meeting_id, url, after_slide) values ($1, 'javascript:alert(1)', 'five_minute')`, [m])),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(user(ids.member), (q) => q(`insert into meeting_slide_links (meeting_id, url, after_slide) values ($1, 'https://example.com', 'welcome')`, [m])),
    ).rejects.toThrow(/row-level security/);
    await withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query(`insert into meeting_slide_links (meeting_id, url, after_slide) values ($1, 'https://example.com', 'welcome')`, [m]);
        await c.query(`set local role authenticated`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
        expect((await c.query(`select * from meeting_slide_links`)).rows.length).toBeGreaterThan(0);
        expect((await c.query(`delete from meeting_slide_links returning id`)).rows).toHaveLength(0);
      } finally {
        await c.query('rollback');
      }
    });
    await expect(as(anon, (q) => q(`select * from meeting_slide_links`))).rejects.toThrow(/permission denied/);
  });
});
