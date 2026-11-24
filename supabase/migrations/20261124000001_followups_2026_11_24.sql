-- Management meeting follow-ups (owner, 2026-11-24). Additive only: new columns, tables, functions, triggers and
-- policies. Nothing is dropped. One data change: upcoming regular meetings that end at 9:30 AM Pacific now end at 9:45.

-- ---------------------------------------------------------------------------
-- 1. Attendance: left-early override and the real end of the Zoom meeting
-- ---------------------------------------------------------------------------
alter table public.attendance
  add column if not exists left_early text check (left_early in ('yes', 'no', 'excused'));
comment on column public.attendance.left_early is
  'Set by an admin: yes = left early, no = did not leave early, excused = left early for an emergency (no infomercial penalty). Null = from Zoom.';

alter table public.attendance_imports
  add column if not exists ended_at timestamptz;
comment on column public.attendance_imports.ended_at is
  'When the Zoom meeting really ended (the last person to leave). Leaving early is measured against this or the scheduled end, whichever is earlier.';

-- Meetings already imported from Zoom: the last person to leave.
update public.attendance_imports i
   set ended_at = z.last_left
  from (select meeting_id, max(left_at) as last_left from public.zoom_participants group by meeting_id) z
 where z.meeting_id = i.meeting_id and i.ended_at is null and z.last_left is not null;

-- Meetings end at 9:45 AM (owner, 2026-11-24). Upcoming regular meetings that still end at 9:30 AM Pacific.
update public.meetings
   set ends_at = ends_at + interval '15 minutes'
 where category = 'Networking'
   and starts_at > now()
   and to_char(ends_at at time zone 'America/Los_Angeles', 'HH24:MI') = '09:30';

-- ---------------------------------------------------------------------------
-- 2. Statistics slide: totals between two moments (end of the last held meeting → end of this one)
-- ---------------------------------------------------------------------------
create or replace function public.group_totals_window(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from_day date := (p_from at time zone 'America/Los_Angeles')::date;
  v_to_day date := (p_to at time zone 'America/Los_Angeles')::date;
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    -- One-on-ones have a date only: the day after the last meeting through this meeting's day (same as the Champion).
    'one_on_ones', (select count(*) from public.one_on_ones o
        where o.confirmed_at is not null and o.met_on > v_from_day and o.met_on <= v_to_day),
    'referrals', (select count(*) from public.referrals r where r.created_at >= p_from and r.created_at < p_to),
    'closed_deals', (select count(*) from public.referrals r where r.status = 'closed_deal'
        and r.closed_at >= p_from and r.closed_at < p_to),
    'closed_amount', (select coalesce(sum(r.amount), 0) from public.referrals r where r.status = 'closed_deal'
        and r.closed_at >= p_from and r.closed_at < p_to),
    'visitors', (select count(*) from public.guest_requests g
        where g.status in ('visited', 'applied', 'joined') and g.created_at >= p_from and g.created_at < p_to)
  );
end $$;
revoke execute on function public.group_totals_window(timestamptz, timestamptz) from public, anon;
grant execute on function public.group_totals_window(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Guest pipeline: stage (board column), accept / decline, history
-- ---------------------------------------------------------------------------
alter table public.guest_requests
  add column if not exists pipeline_stage text not null default 'review'
    check (pipeline_stage in ('review', 'zoom_sent', 'send_application', 'application_done', 'interview', 'approved')),
  add column if not exists stage_changed_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references public.profiles (id) on delete set null,
  add column if not exists declined_at timestamptz,
  add column if not exists declined_by uuid references public.profiles (id) on delete set null,
  add column if not exists decline_method text check (decline_method in ('phone', 'email')),
  add column if not exists decline_note text check (char_length(decline_note) <= 1000);
comment on column public.guest_requests.pipeline_stage is
  'Column on the guest board: review (Accept or Reject), zoom_sent, send_application, application_done, interview, approved.';

create index if not exists guest_requests_stage_idx on public.guest_requests (pipeline_stage, created_at desc);

create or replace function public.guest_stage_rank(p_stage text)
returns integer language sql immutable set search_path = '' as $$
  select case p_stage
    when 'review' then 1 when 'zoom_sent' then 2 when 'send_application' then 3
    when 'application_done' then 4 when 'interview' then 5 when 'approved' then 6 else 0 end;
$$;

-- Where a guest's status puts them on the board (never moves a card backwards).
create or replace function public.guest_stage_for_status(p_status public.guest_status)
returns text language sql immutable set search_path = '' as $$
  select case p_status
    when 'visited' then 'send_application' when 'applied' then 'application_done'
    when 'joined' then 'approved' else 'review' end;
$$;

-- Existing guests: place them from what has already happened.
update public.guest_requests g
   set pipeline_stage = case
         when g.status = 'joined' then 'approved'
         when g.status = 'applied' and g.one_on_ones_done_at is not null then 'interview'
         when g.status = 'applied' then 'application_done'
         when g.status = 'visited' then 'send_application'
         when exists (select 1 from public.email_log l where l.kind = 'guest_zoom_link' and l.status = 'sent'
                      and split_part(l.dedupe_key, ':', 1) = g.id::text) then 'zoom_sent'
         else 'review' end,
       stage_changed_at = coalesce(g.stage_changed_at, g.created_at);

create table if not exists public.guest_events (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guest_requests (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('status', 'stage', 'accepted', 'declined', 'reopened', 'note', 'zoom_link', 'apply_invite', 'interview')),
  detail text check (char_length(detail) <= 1000)
);
create index if not exists guest_events_guest_idx on public.guest_events (guest_id, created_at desc);
alter table public.guest_events enable row level security;
create policy guest_events_admin_read on public.guest_events for select to authenticated using (public.is_admin());
create policy guest_events_admin_insert on public.guest_events for insert to authenticated
  with check (public.is_admin() and (actor_id is null or actor_id = auth.uid()));
revoke all on public.guest_events from anon;
grant select, insert on public.guest_events to authenticated;

-- A status change moves the card forward (never back) and is written to the history.
create or replace function public.guest_requests_stage_before()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_stage text := public.guest_stage_for_status(new.status);
begin
  if tg_op = 'INSERT' then
    if public.guest_stage_rank(v_stage) > public.guest_stage_rank(new.pipeline_stage) then
      new.pipeline_stage := v_stage;
    end if;
    new.stage_changed_at := coalesce(new.stage_changed_at, now());
  elsif new.status is distinct from old.status
        and public.guest_stage_rank(v_stage) > public.guest_stage_rank(new.pipeline_stage) then
    new.pipeline_stage := v_stage;
    new.stage_changed_at := now();
  end if;
  return new;
end $$;
create trigger guest_requests_stage_before before insert or update of status on public.guest_requests
  for each row execute function public.guest_requests_stage_before();

create or replace function public.guest_requests_status_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.guest_events (guest_id, actor_id, kind, detail)
    values (new.id, (select p.id from public.profiles p where p.id = auth.uid()), 'status', new.status::text);
  end if;
  return new;
end $$;
create trigger guest_requests_status_log after update of status on public.guest_requests
  for each row execute function public.guest_requests_status_log();

-- ---------------------------------------------------------------------------
-- 4. Gallery: tag members; a photo goes live only after everyone tagged approves
-- ---------------------------------------------------------------------------
create table if not exists public.gallery_tags (
  photo_id uuid not null references public.gallery_photos (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  tagged_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (photo_id, profile_id)
);
create index if not exists gallery_tags_profile_idx on public.gallery_tags (profile_id, status);
alter table public.gallery_tags enable row level security;

-- True when nobody tagged in the photo is still to answer or has said no.
create or replace function public.gallery_photo_visible(p_photo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.gallery_tags t where t.photo_id = p_photo and t.status <> 'approved');
$$;
create or replace function public.gallery_tagged_me(p_photo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.gallery_tags t where t.photo_id = p_photo and t.profile_id = auth.uid());
$$;
grant execute on function public.gallery_photo_visible(uuid) to anon, authenticated;
grant execute on function public.gallery_tagged_me(uuid) to anon, authenticated;

-- Restrictive: combined with the existing gallery_read policy, a photo waiting for (or refused) approval is seen
-- only by whoever uploaded it, the people tagged in it and admins.
create policy gallery_read_tag_approval on public.gallery_photos as restrictive for select to anon, authenticated
  using (public.gallery_photo_visible(id) or uploaded_by = auth.uid() or public.is_admin() or public.gallery_tagged_me(id));

create policy gallery_tags_read on public.gallery_tags for select to anon, authenticated
  using (
    (status = 'approved' and public.gallery_photo_visible(photo_id))
    or profile_id = auth.uid() or tagged_by = auth.uid() or public.is_admin()
  );
-- The uploader tags members on their own photo; tagging yourself is approved straight away.
create policy gallery_tags_insert on public.gallery_tags for insert to authenticated
  with check (
    public.is_approved_member() and tagged_by = auth.uid()
    and exists (select 1 from public.gallery_photos p where p.id = photo_id and p.uploaded_by = auth.uid())
    and (status = 'pending' or (status = 'approved' and profile_id = auth.uid()))
  );
create policy gallery_tags_admin_delete on public.gallery_tags for delete to authenticated using (public.is_admin());
revoke all on public.gallery_tags from anon;
grant select on public.gallery_tags to anon;
grant select, insert, delete on public.gallery_tags to authenticated;

-- The tagged member answers (and can change their answer).
create or replace function public.respond_gallery_tag(p_photo uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_status text := case when p_approve then 'approved' else 'declined' end;
begin
  update public.gallery_tags set status = v_status, responded_at = now()
   where photo_id = p_photo and profile_id = auth.uid();
  if not found then
    raise exception 'not tagged' using errcode = '42501';
  end if;
  return v_status;
end $$;
revoke execute on function public.respond_gallery_tag(uuid, boolean) from public, anon;
grant execute on function public.respond_gallery_tag(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Member report cards: quarterly goals set by admins (blank = no goal)
-- ---------------------------------------------------------------------------
create table if not exists public.report_card_goals (
  id integer primary key default 1 check (id = 1),
  one_on_ones integer check (one_on_ones between 0 and 200),
  referrals integer check (referrals between 0 and 200),
  visitors integer check (visitors between 0 and 200),
  attendance_pct integer check (attendance_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.report_card_goals (id) values (1) on conflict (id) do nothing;
alter table public.report_card_goals enable row level security;
create policy report_card_goals_admin_read on public.report_card_goals for select to authenticated using (public.is_admin());
create policy report_card_goals_admin_update on public.report_card_goals for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.report_card_goals from anon;
grant select, update on public.report_card_goals to authenticated;
