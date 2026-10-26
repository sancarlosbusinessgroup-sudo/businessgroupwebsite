-- Members change their own login email (owner request 2026-10-27). Additive: one new private table.
-- The site emails a 6-digit code to the new address; the member types it on My profile, then the site (service role)
-- changes the login email and the contact email together. Codes are stored hashed, expire after 15 minutes and allow
-- 5 tries. Only the server (service role) reads or writes this table: no policies, no access for anon or members.

create table public.email_change_requests (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  new_email text not null check (char_length(new_email) <= 254 and new_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  code_hash text not null check (char_length(code_hash) = 64),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.email_change_requests enable row level security;
revoke all on public.email_change_requests from anon, authenticated;
