-- Guest steps, panel interviews and the per-meeting leaderboard (owner, 2026-11-25). Additive only: new columns,
-- tables, functions and policies. Nothing is dropped or rewritten.

-- ---------------------------------------------------------------------------
-- 1. Leaderboards slide: counts between two moments (end of the last held meeting → end of this one)
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_window(p_from timestamptz, p_to timestamptz, p_limit int default 5)
returns table (metric text, rank int, profile_id uuid, first_name text, last_name text, value bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from_day date := (p_from at time zone 'America/Los_Angeles')::date;
  v_to_day date := (p_to at time zone 'America/Los_Angeles')::date;
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  return query
  with c as (
    select p.id as pid, p.first_name as fn, p.last_name as ln,
      -- One-on-ones have a date only: the day after the last meeting through this meeting's day (as the Champion).
      (select count(*) from public.one_on_ones o
        where (o.reporter_id = p.id or o.partner_id = p.id) and o.confirmed_at is not null
          and o.met_on > v_from_day and o.met_on <= v_to_day) as one_on_ones,
      (select count(*) from public.referrals r where r.from_id = p.id and r.created_at >= p_from and r.created_at < p_to) as referrals,
      (select count(*) from public.guest_requests g where g.referrer_id = p.id
        and g.status in ('visited', 'applied', 'joined') and g.created_at >= p_from and g.created_at < p_to) as visitors
    from public.profiles p
    where p.status = 'approved'
  ),
  m as (
    -- No closed business: it is reported as a group total only (owner meeting 2026-10-30).
    select 'one_on_ones'::text as metric, c.pid, c.fn, c.ln, c.one_on_ones as value from c
    union all select 'referrals', c.pid, c.fn, c.ln, c.referrals from c
    union all select 'visitors', c.pid, c.fn, c.ln, c.visitors from c
  ),
  ranked as (
    select m.*, row_number() over (partition by m.metric order by m.value desc, m.fn, m.ln)::int as rn
    from m where m.value > 0
  )
  select r.metric, r.rn, r.pid, r.fn, r.ln, r.value
  from ranked r
  where r.rn <= least(greatest(coalesce(p_limit, 5), 1), 20)
  order by array_position(array['one_on_ones', 'referrals', 'visitors'], r.metric), r.rn;
end $$;
revoke execute on function public.leaderboard_window(timestamptz, timestamptz, int) from public, anon;
grant execute on function public.leaderboard_window(timestamptz, timestamptz, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Guest steps: no emails without a confirm, reminders, calls, admin-added guests
-- ---------------------------------------------------------------------------
alter table public.guest_requests
  add column if not exists added_by uuid references public.profiles (id) on delete set null,
  add column if not exists zoom_email_dismissed_at timestamptz,
  add column if not exists decline_called_at timestamptz,
  add column if not exists membership_declined_at timestamptz,
  add column if not exists membership_declined_by uuid references public.profiles (id) on delete set null,
  add column if not exists membership_called_at timestamptz,
  add column if not exists welcome_email_dismissed_at timestamptz;
comment on column public.guest_requests.added_by is 'Admin who added this guest by hand (they came to a Zoom without an invite request). Null = the website form.';
comment on column public.guest_requests.zoom_email_dismissed_at is 'An admin said the Zoom link email is not needed (for example a friend sent the link).';
comment on column public.guest_requests.decline_called_at is 'Rejected guest: an admin has called them.';
comment on column public.guest_requests.membership_declined_at is 'Membership not approved after the panel interview (no email is sent; an admin calls).';
comment on column public.guest_requests.membership_called_at is 'Membership not approved: an admin has called them.';
comment on column public.guest_requests.welcome_email_dismissed_at is 'An admin said the welcome email is not needed.';

create index if not exists guest_requests_added_by_idx on public.guest_requests (added_by);
create index if not exists guest_requests_membership_declined_by_idx on public.guest_requests (membership_declined_by);

-- ---------------------------------------------------------------------------
-- 3. Panel interviews: three panelists, time options, who can make each, the chosen time
-- ---------------------------------------------------------------------------
create table if not exists public.panel_interviews (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.guest_requests (id) on delete cascade,
  panelist_ids uuid[] not null check (cardinality(panelist_ids) between 1 and 3),
  duration_minutes smallint not null default 30 check (duration_minutes between 10 and 180),
  format text not null default 'zoom' check (format in ('zoom', 'phone', 'in_person')),
  location text check (char_length(location) <= 300),
  status text not null default 'scheduling' check (status in ('scheduling', 'scheduled')),
  scheduled_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  guest_emailed_at timestamptz,
  guest_email_dismissed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null)
);
comment on table public.panel_interviews is 'A guest''s panel interview with three members of Management (owner, 2026-11-25).';
create index if not exists panel_interviews_confirmed_by_idx on public.panel_interviews (confirmed_by);
create index if not exists panel_interviews_created_by_idx on public.panel_interviews (created_by);
create trigger panel_interviews_touch before update on public.panel_interviews
  for each row execute function public.touch_updated_at();

create table if not exists public.panel_interview_slots (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.panel_interviews (id) on delete cascade,
  starts_at timestamptz not null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (interview_id, starts_at)
);
create index if not exists panel_interview_slots_added_by_idx on public.panel_interview_slots (added_by);

create table if not exists public.panel_interview_answers (
  slot_id uuid not null references public.panel_interview_slots (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (slot_id, profile_id)
);
create index if not exists panel_interview_answers_profile_idx on public.panel_interview_answers (profile_id);

alter table public.panel_interviews enable row level security;
alter table public.panel_interview_slots enable row level security;
alter table public.panel_interview_answers enable row level security;

-- Management (admins) only. Panelists are members of Management, so they are admins.
create policy panel_interviews_admin on public.panel_interviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy panel_slots_admin on public.panel_interview_slots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy panel_answers_admin_read on public.panel_interview_answers for select to authenticated using (public.is_admin());
-- Each panelist answers for themselves.
create policy panel_answers_own_write on public.panel_interview_answers for insert to authenticated
  with check (public.is_admin() and profile_id = auth.uid());
create policy panel_answers_own_update on public.panel_interview_answers for update to authenticated
  using (public.is_admin() and profile_id = auth.uid()) with check (public.is_admin() and profile_id = auth.uid());
create policy panel_answers_admin_delete on public.panel_interview_answers for delete to authenticated using (public.is_admin());

revoke all on public.panel_interviews, public.panel_interview_slots, public.panel_interview_answers from anon;
grant select, insert, update, delete on public.panel_interviews, public.panel_interview_slots, public.panel_interview_answers to authenticated;
