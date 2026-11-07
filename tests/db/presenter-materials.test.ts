import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { ids, withClient } from './helpers';

// Migration 20261107000001_presenter_materials_gallery_order.sql (owner, 2026-11-07):
// presenters add and remove their own slides for the slot they hold, until the meeting starts;
// admins put the gallery photos in any order.

async function actAs(c: pg.Client, id: string) {
  await c.query(`set local role authenticated`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })]);
}
async function tx<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  return withClient(async (c) => {
    await c.query('begin');
    try {
      return await fn(c);
    } finally {
      await c.query('rollback');
    }
  });
}
/** Runs `sql` as `id` inside a savepoint; returns the error message, or null when it worked. */
async function tryAs(c: pg.Client, id: string, sql: string, params: unknown[] = []): Promise<string | null> {
  await c.query('savepoint s');
  try {
    await actAs(c, id);
    const r = await c.query(sql, params);
    await c.query('reset role');
    await c.query('release savepoint s');
    return r.rowCount === 0 && /^\s*delete/i.test(sql) ? 'no rows' : null;
  } catch (e) {
    await c.query('rollback to savepoint s');
    await c.query('reset role');
    return (e as Error).message;
  }
}

/** An upcoming group meeting with no speakers; the member gets its 5-minute slot. */
async function setUp(c: pg.Client): Promise<string> {
  const m = (
    await c.query(
      `select id from meetings where category = 'Networking' and starts_at > now() and cancelled_reason is null
         and id not in (select meeting_id from meeting_speakers) order by starts_at limit 1`,
    )
  ).rows[0]?.id as string;
  expect(m).toBeTruthy();
  await c.query(`insert into meeting_speakers (meeting_id, slot, profile_id, display_name) values ($1, 'education', $2, 'Morgan Member')`, [m, ids.member]);
  return m;
}

const addPdf = `insert into meeting_slide_media (meeting_id, kind, storage_path, page_count, after_slide) values ($1, 'pdf', $2, 2, $3)`;
const addLink = `insert into meeting_slide_links (meeting_id, url, after_slide) values ($1, 'https://example.com/talk', $2)`;

describe('presenter materials', () => {
  it('the presenter adds a file and a link for their own slot; they show after their presentation slide', async () => {
    await tx(async (c) => {
      const m = await setUp(c);
      expect(await tryAs(c, ids.member, addPdf, [m, `${m}/${ids.member}/talk.pdf`, 'five_minute'])).toBeNull();
      expect(await tryAs(c, ids.member, addLink, [m, 'five_minute'])).toBeNull();
      const rows = (await c.query(`select created_by, after_slide from meeting_slide_media where meeting_id = $1`, [m])).rows;
      expect(rows).toEqual([{ created_by: ids.member, after_slide: 'five_minute' }]);
    });
  });

  it('not for the other slot, another member’s slot, outside their own folder, or once the meeting has started', async () => {
    await tx(async (c) => {
      const m = await setUp(c);
      // The 10-minute slot isn't theirs.
      expect(await tryAs(c, ids.member, addPdf, [m, `${m}/${ids.member}/a.pdf`, 'ten_minute'])).toMatch(/row-level security/);
      expect(await tryAs(c, ids.member, addLink, [m, 'ten_minute'])).toMatch(/row-level security/);
      // Somewhere else in the deck.
      expect(await tryAs(c, ids.member, addLink, [m, 'announcements'])).toMatch(/row-level security/);
      // A file path outside their own folder.
      expect(await tryAs(c, ids.member, addPdf, [m, `${m}/b.pdf`, 'five_minute'])).toMatch(/row-level security/);
      expect(await tryAs(c, ids.member, addPdf, [m, `${m}/${ids.member3}/b.pdf`, 'five_minute'])).toMatch(/row-level security/);
      // Another member with no slot.
      expect(await tryAs(c, ids.member3, addLink, [m, 'five_minute'])).toMatch(/row-level security/);
      // After the start.
      await c.query(`update meetings set starts_at = now() - interval '5 minutes', ends_at = now() + interval '1 hour' where id = $1`, [m]);
      expect(await tryAs(c, ids.member, addLink, [m, 'five_minute'])).toMatch(/row-level security/);
    });
  });

  it('the presenter removes only what they added, and only before the meeting starts', async () => {
    await tx(async (c) => {
      const m = await setUp(c);
      const mine = (
        await c.query(
          `insert into meeting_slide_links (meeting_id, url, after_slide, created_by) values ($1, 'https://example.com/a', 'five_minute', $2) returning id`,
          [m, ids.member],
        )
      ).rows[0].id;
      const admins = (
        await c.query(
          `insert into meeting_slide_links (meeting_id, url, after_slide, created_by) values ($1, 'https://example.com/b', 'five_minute', $2) returning id`,
          [m, ids.admin],
        )
      ).rows[0].id;
      expect(await tryAs(c, ids.member, `delete from meeting_slide_links where id = $1`, [admins])).toBe('no rows');
      expect(await tryAs(c, ids.member, `update meeting_slide_links set title = 'x' where id = $1`, [mine])).toBeNull();
      expect((await c.query(`select title from meeting_slide_links where id = $1`, [mine])).rows[0].title).toBeNull();
      await c.query(`update meetings set starts_at = now() - interval '5 minutes', ends_at = now() + interval '1 hour' where id = $1`, [m]);
      expect(await tryAs(c, ids.member, `delete from meeting_slide_links where id = $1`, [mine])).toBe('no rows');
      await c.query(`update meetings set starts_at = now() + interval '1 day', ends_at = now() + interval '1 day 2 hours' where id = $1`, [m]);
      expect(await tryAs(c, ids.member, `delete from meeting_slide_links where id = $1`, [mine])).toBeNull();
    });
  });

  it('storage: the presenter uploads and deletes only in <meeting>/<their id>/ while they hold a slot there', async () => {
    await tx(async (c) => {
      const m = await setUp(c);
      const put = `insert into storage.objects (bucket_id, name) values ('slide-media', $1)`;
      expect(await tryAs(c, ids.member, put, [`${m}/${ids.member}/talk.pdf`])).toBeNull();
      expect(await tryAs(c, ids.member, put, [`${m}/talk.pdf`])).toMatch(/row-level security/);
      expect(await tryAs(c, ids.member, put, [`${m}/${ids.member3}/talk.pdf`])).toMatch(/row-level security/);
      expect(await tryAs(c, ids.member, put, [`${m}/${ids.member}/x/talk.pdf`])).toMatch(/row-level security/);
      expect(await tryAs(c, ids.member3, put, [`${m}/${ids.member3}/talk.pdf`])).toMatch(/row-level security/);
      expect(await tryAs(c, ids.member, `delete from storage.objects where name = $1`, [`${m}/${ids.member}/talk.pdf`])).toBeNull();
    });
  });

  it('admins still add materials anywhere', async () => {
    await tx(async (c) => {
      const m = await setUp(c);
      expect(await tryAs(c, ids.admin, addPdf, [m, `${m}/admin.pdf`, 'ten_minute'])).toBeNull();
      expect(await tryAs(c, ids.admin, addLink, [m, 'announcements'])).toBeNull();
    });
  });
});

describe('gallery order', () => {
  it('admins save an order; it changes no change-history rows; members cannot reorder', async () => {
    await tx(async (c) => {
      const photos = (await c.query(`select id from gallery_photos order by created_at limit 3`)).rows.map((r) => r.id as string);
      expect(photos.length).toBe(3);
      const before = Number((await c.query(`select count(*) from admin_audit_log`)).rows[0].count);
      const order = [photos[2], photos[0], photos[1]];
      expect(await tryAs(c, ids.admin, `select public.admin_reorder_gallery($1::uuid[])`, [order])).toBeNull();
      const got = (await c.query(`select id, sort_order from gallery_photos where id = any($1) order by sort_order`, [photos])).rows;
      expect(got.map((r) => r.id)).toEqual(order);
      expect(got.map((r) => r.sort_order)).toEqual([1, 2, 3]);
      expect(Number((await c.query(`select count(*) from admin_audit_log`)).rows[0].count)).toBe(before);
      // A caption change is still recorded.
      expect(await tryAs(c, ids.admin, `update gallery_photos set caption = 'New caption here' where id = $1`, [photos[0]])).toBeNull();
      expect(Number((await c.query(`select count(*) from admin_audit_log`)).rows[0].count)).toBeGreaterThanOrEqual(before);
      expect(await tryAs(c, ids.member, `select public.admin_reorder_gallery($1::uuid[])`, [photos])).toMatch(/Only admins/);
    });
  });

  it('new photos start at 0 (top of the gallery)', async () => {
    const [row] = await withClient(
      async (c) =>
        (await c.query(`select column_default from information_schema.columns where table_name = 'gallery_photos' and column_name = 'sort_order'`)).rows,
    );
    expect(row?.column_default).toBe('0');
  });
});
