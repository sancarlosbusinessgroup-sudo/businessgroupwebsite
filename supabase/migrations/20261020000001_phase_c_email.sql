-- Phase C: email (Brevo). Additive only.
--   * per-member email preferences (own table: profiles rows are public)
--   * email log (audit + "send once" de-duplication)
--   * onboarding after approval

-- ---------------------------------------------------------------------------
-- 1. Email preferences. Missing keys mean "on". Account emails (approval, password) are always sent.
--    Keys: referrals, one_on_ones, meeting_reminders, visitors, digest (admins only)
-- ---------------------------------------------------------------------------
-- Own table (not a profiles column) because profiles rows are publicly readable.
create table public.email_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and char_length(prefs::text) <= 1000),
  updated_at timestamptz not null default now()
);
comment on table public.email_preferences is 'Optional email notifications a member turned off, e.g. {"meeting_reminders": false}. No row or missing key = on.';
create trigger email_preferences_touch before update on public.email_preferences
  for each row execute function public.touch_updated_at();
alter table public.email_preferences enable row level security;
create policy email_prefs_own_read on public.email_preferences for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy email_prefs_own_insert on public.email_preferences for insert to authenticated
  with check (profile_id = auth.uid());
create policy email_prefs_own_update on public.email_preferences for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Email log: what the site sent (or skipped), and a key so each notice goes out once.
--    Written only by the server (service role). Admins can read it.
-- ---------------------------------------------------------------------------
create table public.email_log (
  id bigint generated always as identity primary key,
  kind text not null check (char_length(kind) between 2 and 60),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  recipient text not null check (char_length(recipient) <= 254),
  profile_id uuid references public.profiles (id) on delete set null,
  subject text check (char_length(subject) <= 300),
  status text not null default 'sent' check (status in ('sent', 'skipped', 'failed')),
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  unique (kind, dedupe_key, recipient)
);
create index email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;
create policy email_log_admin_read on public.email_log for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: only the service role writes.

-- ---------------------------------------------------------------------------
-- 3. Onboarding: created when an admin approves an applicant (welcome email links to /onboarding).
-- ---------------------------------------------------------------------------
create table public.member_onboarding (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  invited_at timestamptz not null default now(),
  reminded_at timestamptz,
  completed_at timestamptz,
  share_contacts boolean not null default false,
  agreed_commitments boolean not null default false,
  check (completed_at is null or (share_contacts and agreed_commitments))
);
alter table public.member_onboarding enable row level security;
create policy onboarding_read on public.member_onboarding for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy onboarding_admin_insert on public.member_onboarding for insert to authenticated
  with check (public.is_admin());

-- The member completes their own onboarding (only the consent fields and completion time change).
create or replace function public.complete_onboarding(p_share_contacts boolean, p_agreed boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  if not (coalesce(p_share_contacts, false) and coalesce(p_agreed, false)) then
    raise exception 'please agree to both statements' using errcode = '22023';
  end if;
  insert into public.member_onboarding (profile_id, share_contacts, agreed_commitments, completed_at)
  values (auth.uid(), true, true, now())
  on conflict (profile_id) do update
    set share_contacts = true, agreed_commitments = true, completed_at = coalesce(public.member_onboarding.completed_at, now());
end $$;
revoke execute on function public.complete_onboarding(boolean, boolean) from public, anon;
grant execute on function public.complete_onboarding(boolean, boolean) to authenticated;

-- Visitors (anon) never touch these tables.
revoke all on public.email_preferences, public.email_log, public.member_onboarding from anon;
