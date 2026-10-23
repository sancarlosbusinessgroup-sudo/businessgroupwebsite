import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Phase B (docs/phase-2-spec.md): member events, speaker topics, slide settings, visitors for slides.

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

const event = (host: string, extra = '') =>
  `insert into member_events (host_id, title, category, starts_at, ends_at, is_online, location ${extra ? ',' + extra.split('=')[0] : ''})
   values ('${host}', 'Coffee and connections', 'Networking', now() + interval '3 days', now() + interval '3 days 1 hour', false, 'Laurel St, San Carlos'
   ${extra ? ',' + extra.split('=')[1] : ''}) returning id, slug, host_id`;

describe('member events', () => {
  it('visitors can read member events (public) but cannot post', async () => {
    await as(anon, async (q) => {
      expect((await q(`select id from member_events`)).length).toBeGreaterThan(0);
    });
    await expect(as(anon, (q) => q(event(ids.member)))).rejects.toThrow(/permission denied|row-level security/);
  });

  it('an approved member posts as themselves; the slug is generated and unique', async () => {
    await as(user(ids.member), async (q) => {
      const a = (await q(event(ids.member)))[0];
      const b = (await q(event(ids.member)))[0];
      expect(a?.host_id).toBe(ids.member);
      expect(String(a?.slug)).toMatch(/^coffee-and-connections-[a-z0-9]{6}$/);
      expect(a?.slug).not.toBe(b?.slug);
    });
  });

  it('nobody can post as someone else; pending applicants cannot post', async () => {
    await expect(as(user(ids.member), (q) => q(event(ids.member3)))).rejects.toThrow(/row-level security/);
    await expect(as(user(ids.pending), (q) => q(event(ids.pending)))).rejects.toThrow(/row-level security/);
  });

  it('online events need an https link; in-person events need an address', async () => {
    await expect(
      as(user(ids.member), (q) =>
        q(
          `insert into member_events (host_id, title, starts_at, ends_at, is_online) values ($1, 'Webinar', now() + interval '1 day', now() + interval '1 day 1 hour', true)`,
          [ids.member],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(user(ids.member), (q) =>
        q(
          `insert into member_events (host_id, title, starts_at, ends_at, is_online, online_url) values ($1, 'Webinar', now() + interval '1 day', now() + interval '1 day 1 hour', true, 'http://x.example')`,
          [ids.member],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('images must be in the host’s own upload folder', async () => {
    await expect(as(user(ids.member), (q) => q(event(ids.member, `image_path='${ids.admin}/x.webp'`)))).rejects.toThrow(/row-level security/);
    await as(user(ids.member), async (q) => {
      expect((await q(event(ids.member, `image_path='${ids.member}/event.webp'`))).length).toBe(1);
    });
  });

  it('the host edits and deletes their own event; other members cannot; admins can edit or remove any', async () => {
    await tx(async (c) => {
      const id = (await c.query(event(ids.member))).rows[0]?.id as string;
      await actAs(c, ids.member3);
      expect((await c.query(`update member_events set title='Hijacked' where id=$1 returning id`, [id])).rows).toEqual([]);
      expect((await c.query(`delete from member_events where id=$1 returning id`, [id])).rows).toEqual([]);
      await actAs(c, ids.member);
      expect((await c.query(`update member_events set title='Coffee, round two' where id=$1 returning title`, [id])).rows[0]?.title).toBe('Coffee, round two');
      await c.query('savepoint s');
      await expect(c.query(`update member_events set host_id=$2 where id=$1`, [id, ids.member3])).rejects.toThrow(/row-level security|cannot change/);
      await c.query('rollback to savepoint s');
      await actAs(c, ids.admin);
      expect((await c.query(`update member_events set title='Edited by admin' where id=$1 returning id`, [id])).rows.length).toBe(1);
      expect((await c.query(`delete from member_events where id=$1 returning id`, [id])).rows.length).toBe(1);
    });
  });

  it('a member can post at most 10 events in 30 days', async () => {
    await tx(async (c) => {
      await actAs(c, ids.member3);
      for (let i = 0; i < 10; i++) await c.query(event(ids.member3));
      await expect(c.query(event(ids.member3))).rejects.toThrow(/event limit/);
    });
  });
});

describe('speaker topics', () => {
  it('a member claims a slot with a topic and short description', async () => {
    await as(user(ids.member), async (q) => {
      const m = (await q(`select id from meetings where starts_at > now() + interval '20 days' and slug like 'group-meeting-%' order by starts_at limit 1`))[0];
      const r = await q(
        `insert into meeting_speakers (meeting_id, slot, profile_id, display_name, topic, topic_description)
         values ($1, 'education', $2, 'Marcus Okafor', 'Planning for retirement', 'Three quick tips') returning topic, topic_description`,
        [m?.id, ids.member],
      );
      expect(r[0]).toEqual({ topic: 'Planning for retirement', topic_description: 'Three quick tips' });
    });
  });

  it('topics have length limits', async () => {
    await expect(
      as(user(ids.member), (q) =>
        q(
          `insert into meeting_speakers (meeting_id, slot, profile_id, display_name, topic)
           select id, 'education', $1, 'Marcus Okafor', repeat('x', 121) from meetings where starts_at > now() + interval '20 days' and slug like 'group-meeting-%' order by starts_at limit 1`,
          [ids.member],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('slide settings', () => {
  it('members read them, only admins write them, and slide names are checked', async () => {
    await tx(async (c) => {
      const m = (await c.query(`select id from meetings where slug like 'group-meeting-%' and starts_at > now() order by starts_at limit 1`)).rows[0]?.id;
      await actAs(c, ids.member);
      await c.query('savepoint a');
      await expect(c.query(`insert into meeting_slide_settings (meeting_id, slides) values ($1, '{welcome}')`, [m])).rejects.toThrow(/row-level security/);
      await c.query('rollback to savepoint a');
      await actAs(c, ids.admin);
      await c.query('savepoint b');
      await expect(c.query(`insert into meeting_slide_settings (meeting_id, slides) values ($1, '{welcome,Bad-Name!}')`, [m])).rejects.toThrow(
        /check constraint/,
      );
      await c.query('rollback to savepoint b');
      await c.query(`insert into meeting_slide_settings (meeting_id, slides) values ($1, '{welcome,closing}')`, [m]);
      await actAs(c, ids.member);
      expect((await c.query(`select slides from meeting_slide_settings where meeting_id=$1`, [m])).rows[0]?.slides).toEqual(['welcome', 'closing']);
    });
  });

  it('visitors cannot read slide settings', async () => {
    await as(anon, async (q) => {
      expect(await q(`select * from meeting_slide_settings`)).toEqual([]);
    });
  });
});

describe('visitors for the slides', () => {
  it('members get first name + last initial of guests coming to a meeting; visitors and pending cannot', async () => {
    await as(user(ids.member), async (q) => {
      const m = (await q(`select id from meetings where starts_at > now() order by starts_at limit 1`))[0];
      const rows = await q(`select * from meeting_visitors($1)`, [m?.id]);
      expect(rows.length).toBeGreaterThan(0);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['business_name', 'display_name', 'invited_by']);
      expect(rows.every((r) => /^[A-Z][a-z]+ [A-Z]\.$/.test(String(r.display_name)))).toBe(true);
    });
    await expect(as(anon, (q) => q(`select * from meeting_visitors(gen_random_uuid())`))).rejects.toThrow(/permission denied/);
    await expect(as(user(ids.pending), (q) => q(`select * from meeting_visitors(gen_random_uuid())`))).rejects.toThrow(/members only/);
  });
});
