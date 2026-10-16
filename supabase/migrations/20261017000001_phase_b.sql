-- Phase B (docs/phase-2-spec.md): member events, speaker topics, slide settings.
-- Additive only: no columns, tables or data are dropped.

-- ---------------------------------------------------------------------------
-- 1. Member events: any approved member can post; public; host or admin can edit/delete.
-- ---------------------------------------------------------------------------
create table public.member_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text check (char_length(description) <= 4000),
  category text not null default 'Networking' check (category in ('Networking', 'Social', 'Workshop', 'Community')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_online boolean not null default false,
  online_url text check (online_url is null or (online_url ~* '^https://[^\s]+$' and char_length(online_url) <= 500)),
  location text check (char_length(location) <= 200),
  image_path text check (char_length(image_path) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((is_online and online_url is not null) or (not is_online and location is not null and char_length(trim(location)) > 0))
);
create index member_events_starts_idx on public.member_events (starts_at);
create index member_events_host_idx on public.member_events (host_id, created_at);

-- Slug from the title plus a short random suffix (unique across member events and group meetings).
create or replace function public.prepare_member_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_base text;
  v_slug text;
  v_recent int;
begin
  select count(*) into v_recent from public.member_events e
   where e.host_id = new.host_id and e.created_at > now() - interval '30 days';
  if v_recent >= 10 then
    raise exception 'event limit reached: 10 events per member in 30 days' using errcode = 'P0001';
  end if;
  v_base := left(trim(both '-' from lower(regexp_replace(new.title, '[^a-zA-Z0-9]+', '-', 'g'))), 60);
  if v_base = '' then v_base := 'event'; end if;
  loop
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    exit when not exists (select 1 from public.member_events where slug = v_slug)
      and not exists (select 1 from public.meetings where slug = v_slug);
  end loop;
  new.slug := v_slug;
  new.created_at := now();
  new.updated_at := now();
  return new;
end $$;
create trigger member_events_prepare before insert on public.member_events
  for each row execute function public.prepare_member_event();

create or replace function public.guard_member_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.slug is distinct from old.slug or new.created_at is distinct from old.created_at
     or (new.host_id is distinct from old.host_id and not public.is_admin()) then
    raise exception 'you cannot change the host, link or creation date of an event' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger member_events_guard before update on public.member_events
  for each row execute function public.guard_member_event();

revoke execute on function public.prepare_member_event() from public, anon, authenticated;
revoke execute on function public.guard_member_event() from public, anon, authenticated;

alter table public.member_events enable row level security;
create policy member_events_read on public.member_events for select to anon, authenticated using (true);
create policy member_events_insert on public.member_events for insert to authenticated
  with check (host_id = auth.uid() and public.is_approved_member()
    and (image_path is null or image_path like auth.uid()::text || '/%'));
create policy member_events_update on public.member_events for update to authenticated
  using ((host_id = auth.uid() and public.is_approved_member()) or public.is_admin())
  with check (((host_id = auth.uid() and public.is_approved_member())
      and (image_path is null or image_path like auth.uid()::text || '/%')) or public.is_admin());
create policy member_events_delete on public.member_events for delete to authenticated
  using ((host_id = auth.uid() and public.is_approved_member()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Speaker topics (5-minute and 10-minute slots)
-- ---------------------------------------------------------------------------
alter table public.meeting_speakers
  add column topic text check (char_length(topic) between 3 and 120),
  add column topic_description text check (char_length(topic_description) <= 500);
comment on column public.meeting_speakers.slot is 'education = 5-minute presentation, presentation = 10-minute presentation';

-- ---------------------------------------------------------------------------
-- 3. Meeting slides: which slides to show, in which order (per meeting; defaults in the app)
-- ---------------------------------------------------------------------------
create table public.meeting_slide_settings (
  meeting_id uuid primary key references public.meetings (id) on delete cascade,
  slides text[] not null check (
    cardinality(slides) between 1 and 11
    and slides <@ array['welcome', 'phones', 'visitors', 'newcomers', 'asks', 'five_minute', 'ten_minute',
                        'summary', 'leaderboards', 'events', 'closing']::text[]
  ),
  updated_at timestamptz not null default now()
);
create trigger meeting_slide_settings_touch before update on public.meeting_slide_settings
  for each row execute function public.touch_updated_at();

alter table public.meeting_slide_settings enable row level security;
create policy slide_settings_members_read on public.meeting_slide_settings for select to authenticated
  using (public.is_approved_member());
create policy slide_settings_admin_write on public.meeting_slide_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Guests coming to a meeting, for the "today's visitors" slide: first name + last initial only.
create or replace function public.meeting_visitors(p_meeting uuid)
returns table (display_name text, business_name text, invited_by text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  return query
    select g.first_name || ' ' || upper(left(g.last_name, 1)) || '.', g.business_name,
           case when p.id is not null then p.first_name || ' ' || p.last_name end
      from public.guest_requests g
      left join public.profiles p on p.id = g.referrer_id and p.status = 'approved'
     where g.meeting_id = p_meeting
     order by g.first_name;
end $$;
revoke execute on function public.meeting_visitors(uuid) from public, anon;
grant execute on function public.meeting_visitors(uuid) to authenticated;
