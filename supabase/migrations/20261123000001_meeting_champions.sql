-- BARP Champion per meeting (owner, 2026-11-23). Additive: one new table; champion_awards (monthly) stays as history.
-- The champion of a regular meeting is the member with the most points earned since the previous held meeting ended,
-- up to the end of this meeting (so points reported during the meeting count). The site records the automatic pick
-- after the meeting (service role); admins may choose someone else with a reason.
create table public.meeting_champions (
  meeting_id uuid primary key references public.meetings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  auto_profile_id uuid references public.profiles (id) on delete set null,
  reason text check (char_length(reason) <= 1000),
  points jsonb not null default '{}'::jsonb check (jsonb_typeof(points) = 'object' and char_length(points::text) <= 4000),
  period_from timestamptz,
  period_to timestamptz not null,
  chosen_by uuid references public.profiles (id) on delete set null,
  chosen_at timestamptz not null default now()
);
create index meeting_champions_profile_idx on public.meeting_champions (profile_id);
create index meeting_champions_auto_idx on public.meeting_champions (auto_profile_id);
create index meeting_champions_chosen_by_idx on public.meeting_champions (chosen_by);
create index meeting_champions_period_to_idx on public.meeting_champions (period_to desc);
comment on table public.meeting_champions is 'BARP Champion of each regular meeting: points since the previous meeting, the automatic pick, an admin override with reason.';

alter table public.meeting_champions enable row level security;
-- The badge shows on public profiles, so anyone may read who won.
create policy meeting_champion_read on public.meeting_champions for select to anon, authenticated using (true);
create policy meeting_champion_admin_insert on public.meeting_champions for insert to authenticated with check (public.is_admin());
create policy meeting_champion_admin_update on public.meeting_champions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy meeting_champion_admin_delete on public.meeting_champions for delete to authenticated using (public.is_admin());
grant select on public.meeting_champions to anon, authenticated;
grant insert, update, delete on public.meeting_champions to authenticated;
