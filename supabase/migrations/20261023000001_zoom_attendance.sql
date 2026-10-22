-- Phase D: automatic attendance from Zoom (owner, 2026-10-23).
-- Additive only: new columns on attendance, three new admin-only tables. Nothing is dropped or changed.

-- Attendance details recorded from the Zoom participant report (or by an admin).
alter table public.attendance
  add column zoom boolean not null default false,
  add column joined_at timestamptz,
  add column left_at timestamptz,
  add column minutes integer check (minutes is null or minutes between 0 and 1440),
  add column substitute boolean not null default false;
comment on column public.attendance.zoom is 'Recorded from the Zoom participant report.';
comment on column public.attendance.substitute is 'The member sent a substitute; counts as present (owner, 2026-10-23).';

-- One row per meeting whose attendance has been taken (from Zoom or by hand).
-- Only these meetings count toward the absence limit, so meetings from before Phase D never count as missed.
create table public.attendance_imports (
  meeting_id uuid primary key references public.meetings (id) on delete cascade,
  source text not null check (source in ('zoom', 'manual')),
  zoom_uuid text check (char_length(zoom_uuid) <= 100),
  participants integer not null default 0 check (participants >= 0),
  matched integer not null default 0 check (matched >= 0),
  status text not null default 'done' check (status in ('done', 'error')),
  error text check (char_length(error) <= 500),
  imported_at timestamptz not null default now(),
  imported_by uuid references public.profiles (id) on delete set null
);

-- Everyone in the Zoom report, one row per person per meeting (several joins are merged).
create table public.zoom_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 300),
  name text not null check (char_length(name) <= 200),
  email text check (char_length(email) <= 254),
  joined_at timestamptz,
  left_at timestamptz,
  minutes integer not null default 0 check (minutes between 0 and 1440),
  resolution text not null default 'pending' check (resolution in ('member', 'guest', 'visitor', 'ignored', 'pending')),
  matched_by text check (matched_by in ('email', 'name', 'alias', 'admin')),
  profile_id uuid references public.profiles (id) on delete set null,
  guest_id uuid references public.guest_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (meeting_id, key)
);
create index zoom_participants_pending_idx on public.zoom_participants (meeting_id) where resolution = 'pending';

-- Zoom names / emails an admin has linked to a member, remembered for the next meetings.
create table public.zoom_aliases (
  key text primary key check (char_length(key) between 1 and 300),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.attendance_imports enable row level security;
alter table public.zoom_participants enable row level security;
alter table public.zoom_aliases enable row level security;

create policy attendance_imports_read on public.attendance_imports for select to authenticated
  using (public.is_approved_member() or public.is_admin());
create policy attendance_imports_admin on public.attendance_imports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy zoom_participants_admin on public.zoom_participants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy zoom_aliases_admin on public.zoom_aliases for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.attendance_imports, public.zoom_participants, public.zoom_aliases to authenticated;
revoke all on public.attendance_imports, public.zoom_participants, public.zoom_aliases from anon;
