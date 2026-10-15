-- SCBNG core schema
-- Every table has Row Level Security enabled in 20261015000002_rls.sql.

create type public.member_status as enum ('pending', 'approved', 'declined', 'inactive');
create type public.member_role as enum ('member', 'admin');
create type public.speaker_slot as enum ('education', 'presentation');
create type public.attendance_status as enum ('present', 'excused', 'absent');
create type public.referral_warmth as enum ('hot', 'warm', 'tip');
create type public.referral_status as enum ('sent', 'contacted', 'closed', 'not_a_fit');
create type public.guest_status as enum ('requested', 'visited', 'applied', 'joined');
create type public.gallery_album as enum ('meetings', 'mixers', 'spotlights', 'community');

-- Business categories (one member business per category)
create table public.categories (
  id smallint generated always as identity primary key,
  name text not null unique check (char_length(name) between 2 and 60)
);

-- Member profiles: one row per auth user. Public-safe fields only; contact details live in member_contacts.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  business_name text not null check (char_length(business_name) between 1 and 120),
  category_id smallint references public.categories (id) on delete set null,
  website text check (website is null or website ~* '^https?://'),
  service_area text check (char_length(service_area) <= 120),
  about text check (char_length(about) <= 2000),
  ideal_client text check (char_length(ideal_client) <= 1000),
  listen_for text check (char_length(listen_for) <= 500),
  services text[] not null default '{}' check (cardinality(services) <= 12),
  city text check (char_length(city) <= 80),
  avatar_path text,
  logo_path text,
  status public.member_status not null default 'pending',
  role public.member_role not null default 'member',
  referral_code text not null unique,
  referred_by uuid references public.profiles (id) on delete set null,
  guest_meetings_attended smallint not null default 0 check (guest_meetings_attended between 0 and 2),
  agreed_commitments boolean not null default false,
  show_in_directory boolean not null default true,
  show_stats boolean not null default true,
  show_phone_public boolean not null default false,
  member_since date,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_status_idx on public.profiles (status);
create index profiles_category_idx on public.profiles (category_id);
-- One approved business per category
create unique index profiles_one_per_category on public.profiles (category_id)
  where status = 'approved' and category_id is not null;

-- Private contact details (members only, or phone public when the member opts in)
create table public.member_contacts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) between 7 and 25)
);

-- Meetings and events
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  description text check (char_length(description) <= 4000),
  category text not null default 'Networking' check (category in ('Networking', 'Social')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_online boolean not null default true,
  location text check (char_length(location) <= 200),
  tags text[] not null default '{}',
  organizer_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index meetings_starts_at_idx on public.meetings (starts_at);

-- Zoom link: approved members only
create table public.meeting_links (
  meeting_id uuid primary key references public.meetings (id) on delete cascade,
  join_url text not null check (join_url ~* '^https://'),
  passcode text check (char_length(passcode) <= 40)
);

-- Speaker slots (5-min education, 10-min presentation)
create table public.meeting_speakers (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  slot public.speaker_slot not null,
  profile_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 2 and 120),
  business text check (char_length(business) <= 120),
  created_at timestamptz not null default now(),
  primary key (meeting_id, slot)
);

create table public.rsvps (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, profile_id)
);

create table public.attendance (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.attendance_status not null default 'present',
  checked_in_at timestamptz,
  method text not null default 'self' check (method in ('self', 'admin')),
  primary key (meeting_id, profile_id)
);

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  meeting_id uuid references public.meetings (id) on delete set null,
  note text not null check (char_length(note) between 5 and 1000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Public guest-invite requests
create table public.guest_requests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  business_name text check (char_length(business_name) <= 120),
  invited_by_text text check (char_length(invited_by_text) <= 120),
  referral_code text check (char_length(referral_code) <= 20),
  referrer_id uuid references public.profiles (id) on delete set null,
  meeting_id uuid references public.meetings (id) on delete set null,
  status public.guest_status not null default 'requested',
  created_at timestamptz not null default now()
);
create index guest_requests_referrer_idx on public.guest_requests (referrer_id);
create index guest_requests_email_idx on public.guest_requests (lower(email));

-- Business referrals between members (closed business = status closed + amount)
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  warmth public.referral_warmth not null default 'warm',
  notes text check (char_length(notes) <= 1000),
  status public.referral_status not null default 'sent',
  closed_amount numeric(12, 2) check (closed_amount is null or closed_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index referrals_from_idx on public.referrals (from_id);
create index referrals_to_idx on public.referrals (to_id);

-- One-on-one meetings between members
create table public.one_on_ones (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  met_on date not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> partner_id)
);
create index one_on_ones_reporter_idx on public.one_on_ones (reporter_id);
create index one_on_ones_partner_idx on public.one_on_ones (partner_id);

-- Private rating + note, visible only to the author (and admins)
create table public.one_on_one_feedback (
  one_on_one_id uuid not null references public.one_on_ones (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (one_on_one_id, author_id)
);

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  album public.gallery_album not null,
  caption text not null check (char_length(caption) between 2 and 140),
  taken_on date,
  image_path text not null,
  thumb_path text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gallery_photos_album_idx on public.gallery_photos (album, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_approved_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.role = 'admin'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger referrals_touch before update on public.referrals
  for each row execute function public.touch_updated_at();

-- Members may not change their own status, role, referral code or approval fields.
create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.role is distinct from old.role
     or new.referral_code is distinct from old.referral_code
     or new.referred_by is distinct from old.referred_by
     or new.approved_at is distinct from old.approved_at
     or new.member_since is distinct from old.member_since then
    raise exception 'not allowed to change membership fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_columns();

create or replace function public.stamp_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
    new.member_since := coalesce(new.member_since, current_date);
  end if;
  return new;
end $$;
create trigger profiles_stamp_approval before update on public.profiles
  for each row execute function public.stamp_approval();

-- When an approved member's application came from a guest request, move that request along.
create or replace function public.sync_guest_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  select c.email into v_email from public.member_contacts c where c.profile_id = new.id;
  if v_email is null then
    return new;
  end if;
  if new.status = 'approved' then
    update public.guest_requests set status = 'joined' where lower(email) = lower(v_email);
  end if;
  return new;
end $$;
create trigger profiles_sync_guest after update of status on public.profiles
  for each row execute function public.sync_guest_status();

-- One-on-ones may be reported for today or the previous 14 days.
create or replace function public.check_one_on_one_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.met_on > current_date or new.met_on < current_date - 14 then
    raise exception 'met_on must be within the last 14 days' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger one_on_ones_date before insert on public.one_on_ones
  for each row execute function public.check_one_on_one_date();

-- Only the receiving member can move a referral to closed / not a fit and set the amount.
create or replace function public.guard_referral_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.from_id is distinct from old.from_id or new.to_id is distinct from old.to_id
     or new.contact_name is distinct from old.contact_name or new.created_at is distinct from old.created_at then
    raise exception 'only status, amount and notes can change' using errcode = '42501';
  end if;
  if auth.uid() = old.from_id and auth.uid() <> old.to_id
     and (new.status is distinct from old.status or new.closed_amount is distinct from old.closed_amount) then
    raise exception 'only the receiving member can update status' using errcode = '42501';
  end if;
  if new.status <> 'closed' then
    new.closed_amount := null;
  end if;
  return new;
end $$;
create trigger referrals_guard before update on public.referrals
  for each row execute function public.guard_referral_update();

-- Guest requests: resolve referral code to a member and limit repeat submissions.
create or replace function public.prepare_guest_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recent int;
begin
  select count(*) into v_recent from public.guest_requests g
   where lower(g.email) = lower(new.email) and g.created_at > now() - interval '1 day';
  if v_recent >= 3 then
    raise exception 'too many requests for this email today' using errcode = 'P0001';
  end if;
  select count(*) into v_recent from public.guest_requests g where g.created_at > now() - interval '1 minute';
  if v_recent >= 20 then
    raise exception 'too many requests, please try again shortly' using errcode = 'P0001';
  end if;
  new.status := 'requested';
  new.referrer_id := null;
  if new.referral_code is not null then
    select p.id into new.referrer_id from public.profiles p
     where p.referral_code = upper(new.referral_code) and p.status = 'approved';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger guest_requests_prepare before insert on public.guest_requests
  for each row execute function public.prepare_guest_request();

-- ---------------------------------------------------------------------------
-- New auth user -> pending profile + contact row, from sign-up metadata
-- ---------------------------------------------------------------------------
create or replace function public.make_slug(p_first text, p_last text, p_business text)
returns text language plpgsql set search_path = '' as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  base := lower(regexp_replace(coalesce(nullif(p_business, ''), p_first || ' ' || p_last), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  if base = '' then base := 'member'; end if;
  base := left(base, 60);
  candidate := base;
  while exists (select 1 from public.profiles where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end $$;

create or replace function public.make_referral_code(p_first text)
returns text language plpgsql set search_path = '' as $$
declare
  candidate text;
begin
  loop
    candidate := upper(left(regexp_replace(coalesce(p_first, 'M'), '[^a-zA-Z]', '', 'g') || 'XXXX', 4))
      || '-' || upper(substr(md5(random()::text), 1, 3));
    exit when not exists (select 1 from public.profiles where referral_code = candidate);
  end loop;
  return candidate;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first text := left(coalesce(nullif(trim(m->>'first_name'), ''), 'New'), 60);
  v_last text := left(coalesce(nullif(trim(m->>'last_name'), ''), 'Member'), 60);
  v_business text := left(coalesce(nullif(trim(m->>'business_name'), ''), v_first || ' ' || v_last), 120);
  v_ref uuid;
  v_category smallint;
begin
  if m ? 'referral_code' then
    select id into v_ref from public.profiles
     where referral_code = upper(m->>'referral_code') and status = 'approved';
  end if;
  if (m->>'category_id') ~ '^[0-9]+$' then
    select id into v_category from public.categories where id = (m->>'category_id')::smallint;
  end if;

  insert into public.profiles (
    id, slug, first_name, last_name, business_name, category_id, website, service_area,
    ideal_client, referral_code, referred_by, guest_meetings_attended, agreed_commitments
  ) values (
    new.id,
    public.make_slug(v_first, v_last, v_business),
    v_first, v_last, v_business, v_category,
    case when (m->>'website') ~* '^https?://' then left(m->>'website', 300) end,
    left(nullif(m->>'service_area', ''), 120),
    left(nullif(m->>'ideal_client', ''), 1000),
    public.make_referral_code(v_first),
    v_ref,
    case when (m->>'guest_meetings_attended') ~ '^[0-2]$' then (m->>'guest_meetings_attended')::smallint else 0 end,
    coalesce(m->>'agreed_commitments' = 'true', false)
  );

  insert into public.member_contacts (profile_id, email, phone)
  values (new.id, new.email, left(nullif(m->>'phone', ''), 25));

  update public.guest_requests set status = 'applied'
   where lower(email) = lower(new.email) and status in ('requested', 'visited');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
