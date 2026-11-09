-- Live attendance during the meeting (owner, 2026-11-10).
-- Zoom sends "participant joined / left" events to /api/zoom/webhook while the meeting runs; each one is stored here.
-- The Management Team (admins) sees them live on Admin → Attendance. The participant report imported after the meeting
-- stays the official record; these rows are only for the live view.
-- Additive only: one new table. Nothing is dropped or changed.

create table public.zoom_live_events (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  event text not null check (event in ('joined', 'left')),
  -- Same keys as zoom_participants / zoom_aliases: "email:…" when Zoom gives an email, else "name:…".
  key text not null check (char_length(key) between 1 and 300),
  name text not null check (char_length(name) <= 200),
  email text check (char_length(email) <= 254),
  at timestamptz not null,
  received_at timestamptz not null default now(),
  -- Zoom may send the same event twice.
  unique (meeting_id, event, key, at)
);
create index zoom_live_events_meeting_idx on public.zoom_live_events (meeting_id, at);

comment on table public.zoom_live_events is
  'Join/leave events Zoom sends during a meeting (webhook). Live view for admins only; the after-meeting report is the official attendance.';

alter table public.zoom_live_events enable row level security;

-- Admins read. Only the server (service role, from the Zoom webhook) writes.
create policy zoom_live_events_admin_read on public.zoom_live_events for select to authenticated using (public.is_admin());

revoke all on public.zoom_live_events from anon, authenticated;
grant select on public.zoom_live_events to authenticated;
