-- Owner request 2026-10-21: slides follow the new agenda and can include uploaded images / PDFs and
-- YouTube videos; the application form adds each reference's business name.
-- Changes: one check constraint is replaced (no data removed); everything else is additive.

-- ---------------------------------------------------------------------------
-- 1. Slide order: accept the new agenda slide names (and the old ones, which the app maps).
--    The list of valid names now lives in the app; the database checks the shape.
-- ---------------------------------------------------------------------------
alter table public.meeting_slide_settings drop constraint meeting_slide_settings_slides_check;
alter table public.meeting_slide_settings add constraint meeting_slide_settings_slides_check check (
  cardinality(slides) between 1 and 40
  and array_to_string(slides, ',') ~ '^[a-z_]{2,30}(,[a-z_]{2,30})*$'
);

-- ---------------------------------------------------------------------------
-- 2. Added slides per meeting: an uploaded image, a PDF (one slide per page) or a YouTube video.
-- ---------------------------------------------------------------------------
create table public.meeting_slide_media (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  kind text not null check (kind in ('image', 'pdf', 'youtube')),
  title text check (char_length(title) <= 120),
  storage_path text check (char_length(storage_path) <= 300),
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  start_seconds integer not null default 0 check (start_seconds between 0 and 86400),
  page_count smallint check (page_count between 1 and 40),
  after_slide text not null check (after_slide ~ '^[a-z_]{2,30}$'),
  sort smallint not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'youtube') = (youtube_id is not null)),
  check ((kind = 'youtube') = (storage_path is null)),
  check ((kind = 'pdf') = (page_count is not null))
);
create index meeting_slide_media_meeting_idx on public.meeting_slide_media (meeting_id, sort);
alter table public.meeting_slide_media enable row level security;
create policy slide_media_members_read on public.meeting_slide_media for select to authenticated
  using (public.is_approved_member());
create policy slide_media_admin_insert on public.meeting_slide_media for insert to authenticated
  with check (public.is_admin());
create policy slide_media_admin_update on public.meeting_slide_media for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy slide_media_admin_delete on public.meeting_slide_media for delete to authenticated
  using (public.is_admin());
revoke all on public.meeting_slide_media from anon;

-- Private storage for slide files: members can view (signed links), admins upload and delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slide-media', 'slide-media', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do nothing;

create policy slide_media_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'slide-media' and public.is_approved_member());
create policy slide_media_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'slide-media' and public.is_admin());
create policy slide_media_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'slide-media' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Application form: references now have a business name as well as the type of business.
--    (Same sign-up trigger as before, plus 'business_name' on each reference.)
-- ---------------------------------------------------------------------------
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
          'name', left(r->>'name', 120), 'business', left(r->>'business', 120),
          'business_name', left(r->>'business_name', 120), 'email', left(r->>'email', 254),
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
