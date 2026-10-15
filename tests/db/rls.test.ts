import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

describe('RLS is enabled everywhere', () => {
  it('every public table has row level security on', async () => {
    const rows = await withClient(
      async (c) =>
        (
          await c.query(
            `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
          )
        ).rows,
    );
    expect(rows).toEqual([]);
  });
});

describe('visitors (anon)', () => {
  it('see approved, listed members but not pending applicants', async () => {
    await as(anon, async (q) => {
      const rows = await q(`select id, status from profiles`);
      expect(rows.length).toBeGreaterThan(10);
      expect(rows.every((r) => r.status === 'approved')).toBe(true);
      expect(rows.find((r) => r.id === ids.pending)).toBeUndefined();
    });
  });

  it('cannot read contact details, Zoom links, attendance, referrals or one-on-ones', async () => {
    await as(anon, async (q) => {
      for (const t of ['member_contacts', 'meeting_links', 'attendance', 'referrals', 'one_on_ones', 'one_on_one_feedback', 'guest_requests']) {
        expect(await q(`select * from ${t}`), t).toEqual([]);
      }
    });
  });

  it('can read meetings, speakers, gallery and categories', async () => {
    await as(anon, async (q) => {
      expect((await q(`select id from meetings`)).length).toBeGreaterThan(0);
      expect((await q(`select * from meeting_speakers`)).length).toBeGreaterThan(0);
      expect((await q(`select id from gallery_photos`)).length).toBeGreaterThan(0);
      expect((await q(`select id from categories`)).length).toBeGreaterThan(0);
    });
  });

  it('can submit a guest request, which credits the referrer', async () => {
    await as(anon, async (q) => {
      await q(`insert into guest_requests (first_name, last_name, email, referral_code) values ('Test','Guest','tg@example.org','aver-001')`);
    });
    // inserted row is not readable by anon, so verify through a member transaction
    await withClient(async (c) => {
      await c.query('begin');
      await c.query(`insert into guest_requests (first_name, last_name, email, referral_code) values ('Test','Guest','tg2@example.org','AVER-001')`);
      const r = await c.query(`select referrer_id from guest_requests where email='tg2@example.org'`);
      expect(r.rows[0]?.referrer_id).toBe(ids.admin);
      await c.query('rollback');
    });
  });

  it('cannot forge a guest request status or referrer', async () => {
    await as(anon, (q) =>
      q(`insert into guest_requests (first_name,last_name,email,status,referrer_id) values ('a','b','forge@example.org','joined',$1)`, [ids.member]),
    );
    await withClient(async (c) => {
      const r = await c.query(`select status, referrer_id from guest_requests where email='forge@example.org'`);
      // as() rolled back, so nothing persists either way
      expect(r.rows).toEqual([]);
      await c.query('begin');
      await c.query(`set local role anon`);
      await c.query(`insert into guest_requests (first_name,last_name,email,status,referrer_id) values ('a','b','forge2@example.org','joined',$1)`, [
        ids.member,
      ]);
      await c.query(`reset role`);
      const r2 = await c.query(`select status, referrer_id from guest_requests where email='forge2@example.org'`);
      expect(r2.rows[0]).toEqual({ status: 'requested', referrer_id: null });
      await c.query('rollback');
    });
  });

  it('cannot call member-only functions', async () => {
    await expect(as(anon, (q) => q(`select member_stats()`))).rejects.toThrow(/permission denied/);
    await expect(as(anon, (q) => q(`select join_meeting(gen_random_uuid())`))).rejects.toThrow(/permission denied/);
  });

  it('cannot write members, meetings or gallery rows', async () => {
    await as(anon, async (q) => {
      const upd = await q(`update profiles set business_name = 'hacked' returning id`);
      expect(upd).toEqual([]);
    });
    await expect(as(anon, (q) => q(`insert into meetings (slug,title,starts_at,ends_at) values ('x-y','Hack',now(),now()+interval '1h')`))).rejects.toThrow(
      /row-level security/,
    );
  });
});

describe('pending applicants', () => {
  it('can read and edit their own profile', async () => {
    await as(user(ids.pending), async (q) => {
      const own = await q(`select status from profiles where id = $1`, [ids.pending]);
      expect(own[0]?.status).toBe('pending');
      const upd = await q(`update profiles set about = 'Hello' where id = $1 returning id`, [ids.pending]);
      expect(upd.length).toBe(1);
    });
  });

  it('cannot approve themselves or become admin', async () => {
    await expect(as(user(ids.pending), (q) => q(`update profiles set status = 'approved' where id = $1`, [ids.pending]))).rejects.toThrow(/not allowed/);
    await expect(as(user(ids.pending), (q) => q(`update profiles set role = 'admin' where id = $1`, [ids.pending]))).rejects.toThrow(/not allowed/);
  });

  it('cannot see member contacts, Zoom links or one-on-ones', async () => {
    await as(user(ids.pending), async (q) => {
      expect(await q(`select * from meeting_links`)).toEqual([]);
      expect(await q(`select * from one_on_ones`)).toEqual([]);
      const contacts = await q(`select profile_id from member_contacts`);
      expect(contacts.map((r) => r.profile_id)).toEqual([ids.pending]);
    });
  });

  it('cannot join meetings or send referrals', async () => {
    await expect(as(user(ids.pending), (q) => q(`select join_meeting(id) from meetings limit 1`))).rejects.toThrow(/members only/);
    await expect(
      as(user(ids.pending), (q) => q(`insert into referrals (from_id,to_id,contact_name) values ($1,$2,'Someone')`, [ids.pending, ids.admin])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('approved members', () => {
  it('see contacts and Zoom links', async () => {
    await as(user(ids.member), async (q) => {
      expect((await q(`select * from member_contacts`)).length).toBeGreaterThan(10);
      expect((await q(`select * from meeting_links`)).length).toBeGreaterThan(0);
    });
  });

  it('see only referrals they are part of', async () => {
    await as(user(ids.member3), async (q) => {
      const rows = await q(`select from_id, to_id from referrals`);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.from_id === ids.member3 || r.to_id === ids.member3)).toBe(true);
    });
  });

  it('can send a referral as themselves but not as someone else', async () => {
    await as(user(ids.member), async (q) => {
      const r = await q(`insert into referrals (from_id,to_id,contact_name) values ($1,$2,'New lead') returning id`, [ids.member, ids.admin]);
      expect(r.length).toBe(1);
    });
    await expect(
      as(user(ids.member), (q) => q(`insert into referrals (from_id,to_id,contact_name) values ($1,$2,'Forged')`, [ids.admin, ids.member3])),
    ).rejects.toThrow(/row-level security/);
  });

  it('only the receiver can mark a referral closed', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      const { rows } = await c.query(`insert into referrals (from_id,to_id,contact_name) values ($1,$2,'Lead') returning id`, [ids.member, ids.member3]);
      const id = rows[0]?.id as string;
      await c.query(`set local role authenticated`);
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
      await expect(c.query(`update referrals set status='closed', closed_amount=100 where id=$1`, [id])).rejects.toThrow(/receiving member/);
      await c.query('rollback');
    });
  });

  it('cannot read other members private one-on-one ratings', async () => {
    await as(user(ids.member), async (q) => {
      const rows = await q(`select author_id from one_on_one_feedback`);
      expect(rows.every((r) => r.author_id === ids.member)).toBe(true);
    });
  });

  it('cannot report a one-on-one older than 14 days', async () => {
    await expect(
      as(user(ids.member), (q) => q(`insert into one_on_ones (reporter_id, partner_id, met_on) values ($1,$2,current_date - 20)`, [ids.member, ids.member3])),
    ).rejects.toThrow(/14 days/);
  });

  it('can see their own attendance only', async () => {
    await as(user(ids.member), async (q) => {
      const rows = await q(`select distinct profile_id from attendance`);
      expect(rows.map((r) => r.profile_id)).toEqual([ids.member]);
    });
  });

  it('join_meeting returns the link and records attendance only during the meeting window', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      const { rows } = await c.query(
        `insert into meetings (slug,title,starts_at,ends_at) values ('live-now','Live now', now() - interval '10 minutes', now() + interval '1 hour') returning id`,
      );
      const live = rows[0]?.id as string;
      await c.query(`insert into meeting_links values ($1, 'https://zoom.us/j/1', null)`, [live]);
      const future = (await c.query(`select id from meetings where starts_at > now() + interval '1 day' order by starts_at limit 1`)).rows[0].id as string;
      await c.query(`set local role authenticated`);
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.member, role: 'authenticated' })]);
      const url = (await c.query(`select join_meeting($1) as url`, [live])).rows[0].url;
      expect(url).toBe('https://zoom.us/j/1');
      expect((await c.query(`select status from attendance where meeting_id=$1`, [live])).rows[0]?.status).toBe('present');
      await c.query(`select join_meeting($1)`, [future]);
      expect((await c.query(`select * from attendance where meeting_id=$1`, [future])).rows).toEqual([]);
      await c.query('rollback');
    });
  });

  it('cannot write attendance directly', async () => {
    await expect(
      as(user(ids.member), (q) => q(`insert into attendance (meeting_id, profile_id) select id, $1 from meetings limit 1`, [ids.member])),
    ).rejects.toThrow(/row-level security/);
  });

  it('member_stats works for self and is refused for others', async () => {
    await as(user(ids.member), async (q) => {
      const s = (await q(`select member_stats() as s`))[0]?.s as Record<string, number>;
      expect(s).toHaveProperty('referrals_given');
      expect(s).toHaveProperty('meetings_present');
    });
    await expect(as(user(ids.member), (q) => q(`select member_stats($1)`, [ids.admin]))).rejects.toThrow(/not allowed/);
  });
});

describe('admins', () => {
  it('can approve a pending applicant, stamping member_since', async () => {
    await as(user(ids.admin), async (q) => {
      const r = await q(`update profiles set status='approved' where id=$1 returning member_since, approved_at`, [ids.pending]);
      expect(r[0]?.member_since).not.toBeNull();
      expect(r[0]?.approved_at).not.toBeNull();
    });
  });

  it('can read guest requests and pending profiles', async () => {
    await as(user(ids.admin), async (q) => {
      expect((await q(`select id from guest_requests`)).length).toBeGreaterThan(0);
      expect((await q(`select id from profiles where status='pending'`)).length).toBe(1);
    });
  });
});

describe('storage policies', () => {
  it('members can upload only into their own folder', async () => {
    await as(user(ids.member), async (q) => {
      const ok = await q(`insert into storage.objects (bucket_id, name) values ('gallery', $1) returning id`, [`${ids.member}/photo.webp`]);
      expect(ok.length).toBe(1);
    });
    await expect(
      as(user(ids.member), (q) => q(`insert into storage.objects (bucket_id, name) values ('gallery', $1)`, [`${ids.admin}/x.webp`])),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(user(ids.pending), (q) => q(`insert into storage.objects (bucket_id, name) values ('gallery', $1)`, [`${ids.pending}/x.webp`])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('sign-up trigger', () => {
  it('creates a pending profile and contact row from sign-up metadata', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      const id = '11111111-1111-4111-8111-111111111111';
      await c.query(
        `insert into auth.users (instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
         values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated','new.person@example.org',
         $2::jsonb, now(), now())`,
        [
          id,
          JSON.stringify({
            first_name: 'New',
            last_name: 'Person',
            business_name: 'Brand New Co',
            referral_code: 'AVER-001',
            phone: '555-0100',
            guest_meetings_attended: 'bogus',
          }),
        ],
      );
      const p = (await c.query(`select * from profiles where id=$1`, [id])).rows[0] ?? {};
      expect(p.status).toBe('pending');
      expect(p.role).toBe('member');
      expect(p.referred_by).toBe(ids.admin);
      expect(p.slug).toBe('brand-new-co');
      expect(p.guest_meetings_attended).toBe(0);
      const contact = (await c.query(`select * from member_contacts where profile_id=$1`, [id])).rows[0] ?? {};
      expect(contact.email).toBe('new.person@example.org');
      await c.query('rollback');
    });
  });

  it('ignores attempts to self-assign status or role through metadata', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      const id = '22222222-2222-4222-8222-222222222222';
      await c.query(
        `insert into auth.users (instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
         values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated','sneaky@example.org',
         '{"first_name":"S","last_name":"N","status":"approved","role":"admin"}'::jsonb, now(), now())`,
        [id],
      );
      const p = (await c.query(`select status, role from profiles where id=$1`, [id])).rows[0];
      expect(p).toEqual({ status: 'pending', role: 'member' });
      await c.query('rollback');
    });
  });
});
