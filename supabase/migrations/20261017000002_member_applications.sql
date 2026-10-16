-- Membership application answers (the group's paper "Member Application Form"), stored at sign-up.
-- Additive: new table; handle_new_user() is replaced to also store the answers.

create table public.member_applications (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  applied_on date not null default current_date,
  business_phone text check (char_length(business_phone) <= 25),
  business_address text check (char_length(business_address) <= 200),
  years_in_business text not null check (char_length(years_in_business) between 1 and 60),
  product_service text not null check (char_length(product_service) between 1 and 1000),
  credentials text check (char_length(credentials) <= 1000),
  networking_groups text check (char_length(networking_groups) <= 500),
  "references" jsonb not null default '[]'::jsonb check (jsonb_typeof("references") = 'array' and jsonb_array_length("references") <= 2),
  signature_name text not null check (char_length(signature_name) between 2 and 120),
  agreed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.member_applications enable row level security;
-- Read: the applicant and admins. Written only by the sign-up trigger (no insert/update/delete policies).
create policy applications_read on public.member_applications for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  a jsonb := case when jsonb_typeof(m->'application') = 'object' then m->'application' end;
  v_first text := left(coalesce(nullif(trim(m->>'first_name'), ''), 'New'), 60);
  v_last text := left(coalesce(nullif(trim(m->>'last_name'), ''), 'Member'), 60);
  v_business text := left(coalesce(nullif(trim(m->>'business_name'), ''), v_first || ' ' || v_last), 120);
  v_ref uuid;
  v_category smallint;
  v_refs jsonb := '[]'::jsonb;
  r jsonb;
begin
  if m ? 'referral_code' then
    select id into v_ref from public.profiles
     where referral_code = upper(m->>'referral_code') and status = 'approved';
  end if;
  if (m->>'category_id') ~ '^[0-9]+$' then
    select id into v_category from public.categories where id = (m->>'category_id')::smallint;
  end if;

  insert into public.profiles (
    id, slug, first_name, last_name, business_name, category_id, website, service_area,
    ideal_client, about, referral_code, referred_by, guest_meetings_attended, agreed_commitments
  ) values (
    new.id,
    public.make_slug(v_first, v_last, v_business),
    v_first, v_last, v_business, v_category,
    case when (m->>'website') ~* '^https?://' then left(m->>'website', 300) end,
    left(nullif(m->>'service_area', ''), 120),
    left(nullif(m->>'ideal_client', ''), 1000),
    left(nullif(trim(a->>'product_service'), ''), 2000),
    public.make_referral_code(v_first),
    v_ref,
    case when (m->>'guest_meetings_attended') ~ '^[0-2]$' then (m->>'guest_meetings_attended')::smallint else 0 end,
    coalesce(m->>'agreed_commitments' = 'true', false)
  );

  insert into public.member_contacts (profile_id, email, phone)
  values (new.id, new.email, left(nullif(m->>'phone', ''), 25));

  if a is not null and nullif(trim(a->>'years_in_business'), '') is not null and nullif(trim(a->>'product_service'), '') is not null then
    if jsonb_typeof(a->'references') = 'array' then
      for r in select value from jsonb_array_elements(a->'references') limit 2 loop
        v_refs := v_refs || jsonb_build_array(jsonb_build_object(
          'name', left(r->>'name', 120), 'business', left(r->>'business', 120), 'email', left(r->>'email', 254),
          'phone', left(r->>'phone', 25), 'website', left(r->>'website', 300)));
      end loop;
    end if;
    insert into public.member_applications (
      profile_id, business_phone, business_address, years_in_business, product_service, credentials,
      networking_groups, "references", signature_name
    ) values (
      new.id,
      left(nullif(a->>'business_phone', ''), 25),
      left(nullif(a->>'business_address', ''), 200),
      left(trim(a->>'years_in_business'), 60),
      left(trim(a->>'product_service'), 1000),
      left(nullif(a->>'credentials', ''), 1000),
      left(nullif(a->>'networking_groups', ''), 500),
      v_refs,
      left(coalesce(nullif(trim(a->>'signature_name'), ''), v_first || ' ' || v_last), 120)
    );
  end if;

  update public.guest_requests set status = 'applied'
   where lower(email) = lower(new.email) and status in ('requested', 'visited');
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
