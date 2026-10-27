-- Admins can hide an upcoming meeting from the website (Admin → Meeting schedule → Hide).
-- A hidden meeting is left out of every public list, the countdown, the slides' "next meeting",
-- the members' Meetings page and the automatic emails. It stays in the admin schedule with a
-- "Hidden" mark and can be shown again at any time. Additive: nothing is dropped or changed.
alter table public.meetings
  add column if not exists hidden boolean not null default false;

comment on column public.meetings.hidden is 'Hidden from the website by an admin; still listed on Admin → Meeting schedule.';

-- Admins already write every column of meetings (policy meetings_admin_write); readers may see the flag.
