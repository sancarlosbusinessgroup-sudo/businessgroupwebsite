-- Live activity sync (owner, 2026-11-25). Additive.
--
-- 1. public.activity_versions: one counter per kind of member activity. Statement-level triggers on the activity
--    tables bump it on every insert, edit or delete. It holds no member data (a kind, a number, a time), so every
--    signed-in member can read it. Open pages (Member Activity, Member Stats, the dashboard leaderboard, the report
--    pages and the meeting slides) watch it through Supabase Realtime, with a polling fallback, and reload their data
--    from the same server functions as before when it changes.
-- 2. Duplicate guard: the same referral slip (same giver, receiver and prospect within 24 hours) can no longer be
--    saved twice, e.g. by a double submit. Checked on the live data 2026-11-25: no existing rows break the rule.

create table if not exists public.activity_versions (
  kind text primary key check (kind in ('referrals', 'one_on_ones', 'visitors', 'attendance', 'champion')),
  version bigint not null default 0,
  changed_at timestamptz not null default now()
);
comment on table public.activity_versions is
  'Change counter per kind of member activity, bumped by triggers. Pages watch it (Realtime + polling) to reload live. No member data.';

insert into public.activity_versions (kind) values ('referrals'), ('one_on_ones'), ('visitors'), ('attendance'), ('champion')
on conflict (kind) do nothing;

alter table public.activity_versions enable row level security;
revoke all on public.activity_versions from anon, authenticated;
grant select on public.activity_versions to authenticated;
drop policy if exists activity_versions_read on public.activity_versions;
create policy activity_versions_read on public.activity_versions for select to authenticated using (public.is_approved_member());

create or replace function public.bump_activity_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.activity_versions set version = version + 1, changed_at = now() where kind = tg_argv[0];
  return null;
end $$;
revoke execute on function public.bump_activity_version() from public, anon, authenticated;

drop trigger if exists referrals_live on public.referrals;
create trigger referrals_live after insert or update or delete on public.referrals
  for each statement execute function public.bump_activity_version('referrals');
drop trigger if exists one_on_ones_live on public.one_on_ones;
create trigger one_on_ones_live after insert or update or delete on public.one_on_ones
  for each statement execute function public.bump_activity_version('one_on_ones');
drop trigger if exists guest_requests_live on public.guest_requests;
create trigger guest_requests_live after insert or update or delete on public.guest_requests
  for each statement execute function public.bump_activity_version('visitors');
drop trigger if exists attendance_live on public.attendance;
create trigger attendance_live after insert or update or delete on public.attendance
  for each statement execute function public.bump_activity_version('attendance');
drop trigger if exists meeting_champions_live on public.meeting_champions;
create trigger meeting_champions_live after insert or update or delete on public.meeting_champions
  for each statement execute function public.bump_activity_version('champion');
drop trigger if exists champion_awards_live on public.champion_awards;
create trigger champion_awards_live after insert or update or delete on public.champion_awards
  for each statement execute function public.bump_activity_version('champion');

-- Supabase Realtime sends row changes of tables in this publication (RLS applies to each listener).
-- The local test stack has no such publication; it polls the table instead.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_versions'
     ) then
    alter publication supabase_realtime add table public.activity_versions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Duplicate guards
-- ---------------------------------------------------------------------------

-- One-on-ones: the same two members on the same day is already one row (one_on_ones_pair_day_uidx, 2026-10-28);
-- the site now confirms the other member's report instead of showing an error.

-- The same referral slip (giver, receiver, prospect) within 24 hours is a duplicate. A lock per giver/receiver pair
-- makes two submits at the same moment wait for each other, so the second one sees the first.
create or replace function public.referrals_no_duplicate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.from_id is null or new.to_id is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('referral:' || new.from_id::text || ':' || new.to_id::text, 0));
  if exists (
    select 1 from public.referrals r
     where r.from_id = new.from_id and r.to_id = new.to_id
       and lower(btrim(r.contact_name)) = lower(btrim(new.contact_name))
       and r.created_at > new.created_at - interval '24 hours'
       and r.created_at < new.created_at + interval '24 hours'
  ) then
    raise exception 'duplicate referral slip' using errcode = '23505', hint = 'referral_duplicate';
  end if;
  return new;
end $$;
revoke execute on function public.referrals_no_duplicate() from public, anon, authenticated;

drop trigger if exists referrals_no_duplicate on public.referrals;
create trigger referrals_no_duplicate before insert on public.referrals
  for each row execute function public.referrals_no_duplicate();
