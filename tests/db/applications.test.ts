import { describe, expect, it } from 'vitest';
import { anon, as, ids, user, withClient } from './helpers';

// Membership application answers (from the paper application form), stored by the sign-up trigger.

const application = {
  business_phone: '(650) 555-0101',
  business_address: '1 Main St, San Carlos, CA',
  years_in_business: '6 years',
  product_service: 'Brand design.',
  credentials: 'BFA',
  networking_groups: 'Chamber',
  references: [
    { name: 'Lee Client', business: 'Client Co', email: 'lee@example.org', phone: null, website: null },
    { name: 'Sam Partner', business: 'Partner LLC', email: null, phone: '(650) 555-0199', website: null },
  ],
  signature_name: 'New Person',
};

describe('membership applications', () => {
  it('the sign-up trigger stores the application answers with the agreement time', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const id = '33333333-3333-4333-8333-333333333333';
        await c.query(
          `insert into auth.users (instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
           values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated','apply@example.org',$2::jsonb, now(), now())`,
          [id, JSON.stringify({ first_name: 'New', last_name: 'Person', business_name: 'Apply Co', agreed_commitments: 'true', application })],
        );
        const a = (await c.query(`select * from member_applications where profile_id=$1`, [id])).rows[0] ?? {};
        expect(a.years_in_business).toBe('6 years');
        expect(a.product_service).toBe('Brand design.');
        expect(a.signature_name).toBe('New Person');
        expect(a.references).toHaveLength(2);
        expect(a.references[0]).toMatchObject({ name: 'Lee Client', email: 'lee@example.org' });
        expect(a.agreed_at).not.toBeNull();
        expect(a.applied_on).not.toBeNull();
        const p = (await c.query(`select about, agreed_commitments from profiles where id=$1`, [id])).rows[0];
        expect(p).toEqual({ about: 'Brand design.', agreed_commitments: true });
      } finally {
        await c.query('rollback');
      }
    });
  });

  it('no application row when sign-up metadata has none (e.g. accounts created by admins)', async () => {
    await withClient(async (c) => {
      await c.query('begin');
      try {
        const id = '44444444-4444-4444-8444-444444444444';
        await c.query(
          `insert into auth.users (instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
           values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated','noapp@example.org','{"first_name":"No","last_name":"App"}'::jsonb, now(), now())`,
          [id],
        );
        expect((await c.query(`select * from member_applications where profile_id=$1`, [id])).rows).toEqual([]);
      } finally {
        await c.query('rollback');
      }
    });
  });

  it('only the applicant and admins can read an application; nobody writes one directly', async () => {
    await as(user(ids.pending), async (q) => {
      expect((await q(`select profile_id from member_applications`)).map((r) => r.profile_id)).toEqual([ids.pending]);
    });
    await as(user(ids.member), async (q) => {
      expect(await q(`select * from member_applications`)).toEqual([]);
    });
    await as(user(ids.admin), async (q) => {
      expect((await q(`select profile_id from member_applications where profile_id=$1`, [ids.pending])).length).toBe(1);
    });
    await as(anon, async (q) => {
      expect(await q(`select * from member_applications`)).toEqual([]);
    });
    await expect(
      as(user(ids.member), (q) =>
        q(`insert into member_applications (profile_id, years_in_business, product_service, signature_name) values ($1,'1','x','y')`, [ids.member]),
      ),
    ).rejects.toThrow(/row-level security|permission denied/);
    await as(user(ids.pending), async (q) => {
      expect(await q(`update member_applications set years_in_business='99' returning profile_id`)).toEqual([]);
    });
  });
});
