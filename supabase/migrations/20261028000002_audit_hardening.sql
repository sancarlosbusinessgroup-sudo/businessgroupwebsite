-- Site audit, 2026-10-27: database integrity, missing indexes and the guest-form per-IP limit.
-- Additive and safe to apply while the site is in use: no data is dropped or rewritten.

-- ---------------------------------------------------------------------------
-- 1. Integrity
-- ---------------------------------------------------------------------------
-- A one-on-one between the same two people on the same day counts once.
create unique index if not exists one_on_ones_pair_day_uidx
  on public.one_on_ones (least(reporter_id, partner_id), greatest(reporter_id, partner_id), met_on);

-- Only one open request per pair (the trigger already refuses a second; this makes it a hard rule).
create unique index if not exists one_on_one_requests_pending_uidx
  on public.one_on_one_requests (requester_id, invitee_id) where status = 'pending';

-- A deleted member's champion month stays on record instead of vanishing.
alter table public.champion_awards alter column profile_id drop not null;
alter table public.champion_awards drop constraint if exists champion_awards_profile_id_fkey;
alter table public.champion_awards
  add constraint champion_awards_profile_id_fkey foreign key (profile_id) references public.profiles (id) on delete set null;

-- Referral guard: compare with IS DISTINCT FROM so a NULL on either side can never skip a check.
create or replace function public.guard_referral_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if (new.from_id is distinct from old.from_id and (new.from_id is not null or exists (select 1 from public.profiles where id = old.from_id)))
       or (new.to_id is distinct from old.to_id and (new.to_id is not null or exists (select 1 from public.profiles where id = old.to_id)))
       or new.contact_name is distinct from old.contact_name or new.created_at is distinct from old.created_at then
      raise exception 'you cannot change who is on a referral or the prospect name' using errcode = '42501';
    end if;
    -- `auth.uid() <> old.to_id` was NULL (so the check was skipped) when the receiver had left; IS DISTINCT FROM is not.
    if auth.uid() is not distinct from old.from_id and auth.uid() is distinct from old.to_id and new.status is distinct from old.status then
      raise exception 'only the receiving member can update status' using errcode = '42501';
    end if;
  end if;
  if new.status = 'closed_deal' then
    new.closed_at := case when old.status = 'closed_deal' then old.closed_at else now() end;
  else
    new.closed_at := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Indexes (foreign keys without one, plus the columns the pages filter and sort on)
-- ---------------------------------------------------------------------------
create index if not exists attendance_imports_imported_by_idx on public.attendance_imports (imported_by);
create index if not exists gallery_photos_uploaded_by_idx on public.gallery_photos (uploaded_by);
create index if not exists leadership_profile_idx on public.leadership (profile_id);
create index if not exists meeting_slide_links_created_by_idx on public.meeting_slide_links (created_by);
create index if not exists meeting_slide_media_created_by_idx on public.meeting_slide_media (created_by);
create index if not exists meetings_organizer_idx on public.meetings (organizer_id);
create index if not exists one_on_one_feedback_author_idx on public.one_on_one_feedback (author_id);
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);
create index if not exists one_on_ones_met_on_idx on public.one_on_ones (met_on);
create index if not exists one_on_ones_confirmed_idx on public.one_on_ones (confirmed_at);
create index if not exists meetings_category_starts_idx on public.meetings (category, starts_at);
create index if not exists guest_requests_status_created_idx on public.guest_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Guest form: limit requests per network address (5 per hour) on top of the per-email limit.
--    The address is stored only as a salted hash, never in the clear.
-- ---------------------------------------------------------------------------
alter table public.guest_requests add column if not exists ip_hash text check (char_length(ip_hash) <= 64);
create index if not exists guest_requests_ip_hash_idx on public.guest_requests (ip_hash, created_at desc) where ip_hash is not null;

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
  if new.ip_hash is not null then
    select count(*) into v_recent from public.guest_requests g
     where g.ip_hash = new.ip_hash and g.created_at > now() - interval '1 hour';
    if v_recent >= 5 then
      raise exception 'too many requests from this network, please try again later' using errcode = 'P0001';
    end if;
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
