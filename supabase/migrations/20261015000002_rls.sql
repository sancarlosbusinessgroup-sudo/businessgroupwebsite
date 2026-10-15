-- Row Level Security: enabled on every table with explicit policies.
-- Roles: anon (visitors), authenticated (signed in; may be pending), approved members, admins.

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.member_contacts enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_links enable row level security;
alter table public.meeting_speakers enable row level security;
alter table public.rsvps enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.guest_requests enable row level security;
alter table public.referrals enable row level security;
alter table public.one_on_ones enable row level security;
alter table public.one_on_one_feedback enable row level security;
alter table public.gallery_photos enable row level security;

-- categories ----------------------------------------------------------------
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy categories_admin_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles ------------------------------------------------------------------
create policy profiles_public_directory on public.profiles for select to anon, authenticated
  using (status = 'approved' and show_in_directory);
create policy profiles_members_read on public.profiles for select to authenticated
  using (status = 'approved' and public.is_approved_member());
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_admin_read on public.profiles for select to authenticated
  using (public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- member_contacts (never visible to anon) ----------------------------------------
create policy contacts_read_own on public.member_contacts for select to authenticated
  using (profile_id = auth.uid());
create policy contacts_members_read on public.member_contacts for select to authenticated
  using (public.is_approved_member() and exists (
    select 1 from public.profiles p where p.id = profile_id and p.status = 'approved'));
create policy contacts_admin_read on public.member_contacts for select to authenticated
  using (public.is_admin());
create policy contacts_update_own on public.member_contacts for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- meetings ------------------------------------------------------------------
create policy meetings_read on public.meetings for select to anon, authenticated using (true);
create policy meetings_admin_write on public.meetings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- meeting_links: approved members only --------------------------------------------
create policy links_members_read on public.meeting_links for select to authenticated
  using (public.is_approved_member());
create policy links_admin_write on public.meeting_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- meeting_speakers ------------------------------------------------------------
create policy speakers_read on public.meeting_speakers for select to anon, authenticated using (true);
create policy speakers_claim on public.meeting_speakers for insert to authenticated
  with check (public.is_approved_member() and profile_id = auth.uid()
    and exists (select 1 from public.meetings m where m.id = meeting_id and m.starts_at > now()));
create policy speakers_release_own on public.meeting_speakers for delete to authenticated
  using (profile_id = auth.uid());
create policy speakers_admin_write on public.meeting_speakers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- rsvps -------------------------------------------------------------------
create policy rsvps_read_own on public.rsvps for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy rsvps_insert_own on public.rsvps for insert to authenticated
  with check (profile_id = auth.uid() and public.is_approved_member());
create policy rsvps_delete_own on public.rsvps for delete to authenticated
  using (profile_id = auth.uid());

-- attendance (members check in through join_meeting(); only admins write directly) ----
create policy attendance_read_own on public.attendance for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy attendance_admin_write on public.attendance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- attendance_corrections --------------------------------------------------------
create policy corrections_insert_own on public.attendance_corrections for insert to authenticated
  with check (profile_id = auth.uid() and public.is_approved_member());
create policy corrections_read on public.attendance_corrections for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy corrections_admin_update on public.attendance_corrections for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- guest_requests: anyone may submit (trigger validates + rate limits) ------------------
create policy guests_insert on public.guest_requests for insert to anon, authenticated
  with check (status = 'requested');
create policy guests_read_referrer on public.guest_requests for select to authenticated
  using (referrer_id = auth.uid() or public.is_admin());
create policy guests_admin_update on public.guest_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy guests_admin_delete on public.guest_requests for delete to authenticated
  using (public.is_admin());

-- referrals ------------------------------------------------------------------
create policy referrals_read_party on public.referrals for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid() or public.is_admin());
create policy referrals_insert on public.referrals for insert to authenticated
  with check (from_id = auth.uid() and public.is_approved_member() and status = 'sent'
    and exists (select 1 from public.profiles p where p.id = to_id and p.status = 'approved'));
create policy referrals_update_party on public.referrals for update to authenticated
  using (from_id = auth.uid() or to_id = auth.uid() or public.is_admin())
  with check (from_id = auth.uid() or to_id = auth.uid() or public.is_admin());
create policy referrals_delete on public.referrals for delete to authenticated
  using ((from_id = auth.uid() and status = 'sent') or public.is_admin());

-- one_on_ones: visible to all approved members (group activity) -----------------------
create policy oneonones_members_read on public.one_on_ones for select to authenticated
  using (public.is_approved_member());
create policy oneonones_insert on public.one_on_ones for insert to authenticated
  with check (reporter_id = auth.uid() and confirmed_at is null and public.is_approved_member()
    and exists (select 1 from public.profiles p where p.id = partner_id and p.status = 'approved'));
create policy oneonones_delete on public.one_on_ones for delete to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy oneonones_admin_update on public.one_on_ones for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- one_on_one_feedback: private to the author ------------------------------------
create policy feedback_read_own on public.one_on_one_feedback for select to authenticated
  using (author_id = auth.uid() or public.is_admin());
create policy feedback_insert_own on public.one_on_one_feedback for insert to authenticated
  with check (author_id = auth.uid() and exists (
    select 1 from public.one_on_ones o where o.id = one_on_one_id
      and (o.reporter_id = auth.uid() or o.partner_id = auth.uid())));

-- gallery_photos ---------------------------------------------------------------
create policy gallery_read on public.gallery_photos for select to anon, authenticated using (true);
create policy gallery_insert on public.gallery_photos for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_approved_member()
    and image_path like auth.uid()::text || '/%' and thumb_path like auth.uid()::text || '/%');
create policy gallery_delete on public.gallery_photos for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: two public-read buckets; members write only inside their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gallery', 'gallery', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('profile-media', 'profile-media', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy storage_public_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('gallery', 'profile-media'));
create policy storage_member_upload on storage.objects for insert to authenticated
  with check (bucket_id in ('gallery', 'profile-media') and public.is_approved_member()
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_member_update on storage.objects for update to authenticated
  using (bucket_id in ('gallery', 'profile-media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_member_delete on storage.objects for delete to authenticated
  using (bucket_id in ('gallery', 'profile-media')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Self check-in: returns the Zoom link to approved members; records attendance when
-- called between 15 minutes before the start and the end of the meeting.
create or replace function public.join_meeting(p_meeting uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  select m.starts_at, m.ends_at, l.join_url into v_start, v_end, v_url
    from public.meetings m join public.meeting_links l on l.meeting_id = m.id
   where m.id = p_meeting;
  if v_url is null then
    raise exception 'no join link for this meeting' using errcode = 'P0002';
  end if;
  if now() between v_start - interval '15 minutes' and v_end then
    insert into public.attendance (meeting_id, profile_id, status, checked_in_at, method)
    values (p_meeting, auth.uid(), 'present', now(), 'self')
    on conflict (meeting_id, profile_id) do update
      set status = 'present', checked_in_at = coalesce(public.attendance.checked_in_at, now());
  end if;
  return v_url;
end $$;

-- Partner confirms a one-on-one someone reported with them (optional private rating).
create or replace function public.confirm_one_on_one(p_id uuid, p_rating smallint default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  update public.one_on_ones set confirmed_at = coalesce(confirmed_at, now())
   where id = p_id and partner_id = auth.uid();
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_rating is not null then
    insert into public.one_on_one_feedback (one_on_one_id, author_id, rating)
    values (p_id, auth.uid(), p_rating)
    on conflict (one_on_one_id, author_id) do update set rating = excluded.rating;
  end if;
end $$;

-- Full stats for the signed-in member (or any member, for admins).
create or replace function public.member_stats(p_profile uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_profile, auth.uid());
  v_since timestamptz := now() - interval '90 days';
  v_from timestamptz;
  v jsonb;
begin
  if v_id is null or (v_id <> auth.uid() and not public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select coalesce(p.approved_at, p.created_at) into v_from from public.profiles p where p.id = v_id;
  select jsonb_build_object(
    'referrals_given', (select count(*) from public.referrals r where r.from_id = v_id and r.created_at >= v_since),
    'referrals_given_prior', (select count(*) from public.referrals r where r.from_id = v_id
        and r.created_at >= v_since - interval '90 days' and r.created_at < v_since),
    'referrals_received', (select count(*) from public.referrals r where r.to_id = v_id and r.created_at >= v_since),
    'referrals_received_closed', (select count(*) from public.referrals r where r.to_id = v_id and r.status = 'closed' and r.created_at >= v_since),
    'closed_amount', (select coalesce(sum(r.closed_amount), 0) from public.referrals r where r.to_id = v_id and r.status = 'closed' and r.updated_at >= v_since),
    'one_on_ones', (select count(*) from public.one_on_ones o where (o.reporter_id = v_id or o.partner_id = v_id) and o.met_on >= (v_since)::date),
    'group_avg_one_on_ones', (select round(coalesce(avg(c), 0)) from (
        select count(o.id) c from public.profiles p
        left join public.one_on_ones o on (o.reporter_id = p.id or o.partner_id = p.id) and o.met_on >= (v_since)::date
        where p.status = 'approved' group by p.id) t),
    'meetings_held', (select count(*) from public.meetings m where m.category = 'Networking'
        and m.ends_at < now() and m.ends_at >= v_from and m.ends_at >= now() - interval '365 days'),
    'meetings_present', (select count(*) from public.attendance a join public.meetings m on m.id = a.meeting_id
        where a.profile_id = v_id and a.status = 'present' and m.category = 'Networking'
        and m.ends_at < now() and m.ends_at >= v_from and m.ends_at >= now() - interval '365 days'),
    'guests_invited', (select count(*) from public.guest_requests g where g.referrer_id = v_id),
    'guests_visited', (select count(*) from public.guest_requests g where g.referrer_id = v_id and g.status in ('visited', 'applied', 'joined')),
    'guests_applied', (select count(*) from public.guest_requests g where g.referrer_id = v_id and g.status in ('applied', 'joined')),
    'guests_joined', (select count(*) from public.guest_requests g where g.referrer_id = v_id and g.status = 'joined')
  ) into v;
  return v;
end $$;

-- Referrals given and one-on-ones per month for the last 6 months (signed-in member).
create or replace function public.monthly_activity()
returns table (month date, referrals bigint, one_on_ones bigint)
language sql stable security definer set search_path = '' as $$
  with months as (
    select (date_trunc('month', now()) - make_interval(months => g))::date as m
    from generate_series(0, 5) g
  )
  select months.m,
    (select count(*) from public.referrals r where r.from_id = auth.uid()
       and date_trunc('month', r.created_at)::date = months.m),
    (select count(*) from public.one_on_ones o where (o.reporter_id = auth.uid() or o.partner_id = auth.uid())
       and date_trunc('month', o.met_on)::date = months.m)
  from months
  where auth.uid() is not null
  order by months.m;
$$;

-- Group totals for the current month (approved members only).
create or replace function public.group_month_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'closed_amount', (select coalesce(sum(closed_amount), 0) from public.referrals
       where status = 'closed' and updated_at >= date_trunc('month', now())),
    'one_on_ones', (select count(*) from public.one_on_ones where met_on >= date_trunc('month', now())::date)
  );
end $$;

-- Top inviters this calendar year (approved members only).
create or replace function public.top_inviters(p_limit int default 5)
returns table (profile_id uuid, first_name text, last_name text, invited bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  return query
    select p.id, p.first_name, p.last_name, count(g.id)
      from public.guest_requests g join public.profiles p on p.id = g.referrer_id
     where g.created_at >= date_trunc('year', now()) and p.status = 'approved'
     group by p.id, p.first_name, p.last_name
     order by count(g.id) desc, p.first_name
     limit least(greatest(p_limit, 1), 20);
end $$;

-- Public profile stats, only when the member chose to show them.
create or replace function public.public_member_stats(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid;
  v_from timestamptz;
  v_held bigint;
  v_present bigint;
begin
  select p.id, coalesce(p.approved_at, p.created_at) into v_id, v_from from public.profiles p
   where p.slug = p_slug and p.status = 'approved' and p.show_stats and p.show_in_directory;
  if v_id is null then
    return null;
  end if;
  select count(*) into v_held from public.meetings m where m.category = 'Networking'
    and m.ends_at < now() and m.ends_at >= v_from and m.ends_at >= now() - interval '365 days';
  select count(*) into v_present from public.attendance a join public.meetings m on m.id = a.meeting_id
   where a.profile_id = v_id and a.status = 'present' and m.category = 'Networking'
     and m.ends_at < now() and m.ends_at >= v_from and m.ends_at >= now() - interval '365 days';
  return jsonb_build_object(
    'attendance_pct', case when v_held = 0 then null else round(100.0 * v_present / v_held) end,
    'referrals_given', (select count(*) from public.referrals r where r.from_id = v_id and r.created_at >= now() - interval '90 days'),
    'one_on_ones', (select count(*) from public.one_on_ones o where (o.reporter_id = v_id or o.partner_id = v_id) and o.met_on >= current_date - 90),
    'members_invited', (select count(*) from public.guest_requests g where g.referrer_id = v_id and g.status = 'joined')
  );
end $$;

-- Phone number for a public profile when the member opted in.
create or replace function public.public_phone(p_slug text)
returns text language sql stable security definer set search_path = '' as $$
  select c.phone from public.profiles p join public.member_contacts c on c.profile_id = p.id
   where p.slug = p_slug and p.status = 'approved' and p.show_in_directory and p.show_phone_public;
$$;

-- Number of approved member businesses (public stat).
create or replace function public.member_count()
returns bigint language sql stable security definer set search_path = '' as $$
  select count(*) from public.profiles where status = 'approved';
$$;

revoke execute on function public.join_meeting(uuid) from public, anon;
revoke execute on function public.confirm_one_on_one(uuid, smallint) from public, anon;
revoke execute on function public.member_stats(uuid) from public, anon;
revoke execute on function public.monthly_activity() from public, anon;
revoke execute on function public.group_month_stats() from public, anon;
revoke execute on function public.top_inviters(int) from public, anon;
grant execute on function public.join_meeting(uuid) to authenticated;
grant execute on function public.confirm_one_on_one(uuid, smallint) to authenticated;
grant execute on function public.member_stats(uuid) to authenticated;
grant execute on function public.monthly_activity() to authenticated;
grant execute on function public.group_month_stats() to authenticated;
grant execute on function public.top_inviters(int) to authenticated;
grant execute on function public.public_member_stats(text) to anon, authenticated;
grant execute on function public.public_phone(text) to anon, authenticated;
grant execute on function public.member_count() to anon, authenticated;

-- Internal helpers are not part of the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.make_slug(text, text, text) from public, anon, authenticated;
revoke execute on function public.make_referral_code(text) from public, anon, authenticated;
