-- Owner 2026-11-10: visitors who were only in the Zoom report (never filled in the guest form) can be given the member
-- who invited them on Admin → Attendance, so they show up with their inviter in the Member and Management recaps.
-- Additive: one nullable column and its index. Admin-only access is unchanged (zoom_participants_admin policy).
alter table public.zoom_participants
  add column invited_by uuid references public.profiles (id) on delete set null;

create index zoom_participants_invited_by_idx on public.zoom_participants (invited_by) where invited_by is not null;
