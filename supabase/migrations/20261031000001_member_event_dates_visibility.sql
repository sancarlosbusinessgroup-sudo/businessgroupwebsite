-- Owner request 2026-10-31: member events with several dates, and a choice of who can see them.
-- Additive columns; the read rule is tightened so members-only events never reach visitors.

-- 1. Who can see the event: everyone (default, as before) or signed-in members only.
alter table public.member_events
  add column visibility text not null default 'public' check (visibility in ('public', 'members'));

-- 2. Several dates: each date is its own event row (so lists, calendars and feeds keep working); rows posted
--    together share a series id so the event page can list the other dates and edits apply to all of them.
alter table public.member_events
  add column series_id uuid;
create index member_events_series_idx on public.member_events (series_id) where series_id is not null;

-- 3. Read rule: public events for everyone; members-only events for approved members, the host and admins.
alter policy member_events_read on public.member_events
  using (visibility = 'public' or public.is_approved_member() or host_id = auth.uid() or public.is_admin());

-- 4. Posting limit: was 10 event rows per member in 30 days. One post can now hold up to 10 dates (one row each),
--    so the limit counts up to 30 rows.
create or replace function public.prepare_member_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_base text;
  v_slug text;
  v_recent int;
begin
  select count(*) into v_recent from public.member_events e
   where e.host_id = new.host_id and e.created_at > now() - interval '30 days';
  if v_recent >= 30 then
    raise exception 'event limit reached: 30 event dates per member in 30 days' using errcode = 'P0001';
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
revoke execute on function public.prepare_member_event() from public, anon, authenticated;
