-- Follow-ups from the website review meeting (owner meeting 2026-10-30; owner asked for them 2026-11-01).
-- Additive only: new nullable columns and a new table. Nothing is dropped or rewritten.

-- 1. Second business name (e.g. a member with two businesses). Shown wherever the business name is, so visitors may read it.
-- 2. Birthday as month + day only (never the year). Members only: anon has column-level grants (20261028000003), so new
--    columns are hidden from visitors unless granted below.
alter table public.profiles
  add column second_business_name text check (second_business_name is null or char_length(second_business_name) between 1 and 120),
  add column birthday_month smallint check (birthday_month between 1 and 12),
  add column birthday_day smallint check (birthday_day between 1 and 31),
  add constraint profiles_birthday_both check ((birthday_month is null) = (birthday_day is null));

grant select (second_business_name) on public.profiles to anon;

-- 3. Guest follow-up survey: one per guest, opened from a link in an email (random token, no login).
--    Only the server (service role) reads and writes it by token; admins can read the answers.
create table public.guest_surveys (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.guest_requests (id) on delete cascade,
  token text not null unique check (char_length(token) between 32 and 100),
  sent_at timestamptz not null default now(),
  answered_at timestamptz,
  coming_back text check (coming_back in ('yes', 'maybe', 'no')),
  interested_in_joining text check (interested_in_joining in ('yes', 'maybe', 'no')),
  most_interesting text check (char_length(most_interesting) <= 1000),
  one_on_one_with text check (char_length(one_on_one_with) <= 300),
  comments text check (char_length(comments) <= 1000)
);

alter table public.guest_surveys enable row level security;
create policy guest_surveys_admin_read on public.guest_surveys for select to authenticated using (public.is_admin());
revoke all on public.guest_surveys from anon;
revoke insert, update, delete on public.guest_surveys from authenticated;
