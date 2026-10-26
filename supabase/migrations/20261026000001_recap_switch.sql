-- Meeting recap on/off switch (owner request 2026-10-26). Additive: one new single-row table, nothing changed or removed.
-- Admins turn the automatic meeting recap email on or off on Admin → Meeting recap. The after-meeting and daily jobs
-- (service role) read it and skip the recap while it is off. On by default, so nothing changes until an admin switches it off.

create table public.email_settings (
  id smallint primary key default 1 check (id = 1),
  meeting_recaps_enabled boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.email_settings (id) values (1);

alter table public.email_settings enable row level security;

create policy email_settings_admin_read on public.email_settings for select to authenticated using (public.is_admin());
create policy email_settings_admin_update on public.email_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.email_settings from anon;
grant select, update (meeting_recaps_enabled, updated_by, updated_at) on public.email_settings to authenticated;

create index email_settings_updated_by_idx on public.email_settings (updated_by);
