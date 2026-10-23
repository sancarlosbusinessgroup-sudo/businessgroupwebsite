-- BARP Champion of the month (owner agreed 2026-10-23). Additive: one new table.
-- The automatic ranking is computed by the site; this table stores the champion an admin confirmed or chose, with a reason.
create table public.champion_awards (
  month date primary key check (extract(day from month) = 1),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  auto_profile_id uuid references public.profiles (id) on delete set null,
  reason text check (char_length(reason) <= 1000),
  points jsonb not null default '{}'::jsonb check (jsonb_typeof(points) = 'object' and char_length(points::text) <= 4000),
  chosen_by uuid references public.profiles (id) on delete set null,
  chosen_at timestamptz not null default now()
);
create index champion_awards_profile_idx on public.champion_awards (profile_id);
create index champion_awards_auto_idx on public.champion_awards (auto_profile_id);
create index champion_awards_chosen_by_idx on public.champion_awards (chosen_by);
comment on table public.champion_awards is 'BARP Champion of each month: the winner, the automatic pick, the reason and a snapshot of the points.';

alter table public.champion_awards enable row level security;
-- The badge shows on public profiles, so anyone may read who won.
create policy champion_read on public.champion_awards for select to anon, authenticated using (true);
create policy champion_admin_insert on public.champion_awards for insert to authenticated with check (public.is_admin());
create policy champion_admin_update on public.champion_awards for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy champion_admin_delete on public.champion_awards for delete to authenticated using (public.is_admin());
