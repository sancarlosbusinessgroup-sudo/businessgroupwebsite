-- Owner change requests, 2026-10-17:
--   * dollar value on referral slips again (shown in group totals, admin stats and the slides)
--   * cancelled meetings stay on the schedule with a reason (e.g. a holiday)
--   * "Request a one-on-one" (a meeting that hasn't happened yet)
--   * slides: new agenda slides and extra text per slide
--
-- The only non-additive statement is the swap of the slide-list CHECK constraint on
-- meeting_slide_settings (dropped and re-created with the new slide names). No data is removed.

-- ---------------------------------------------------------------------------
-- 1. Referral value
-- ---------------------------------------------------------------------------
alter table public.referrals
  add column amount numeric(12, 2) check (amount is null or (amount >= 0 and amount <= 100000000));
comment on column public.referrals.amount is 'Dollar value of the business. The giver can enter an estimate; the receiver updates it, e.g. when the deal closes.';

-- Group totals now include the dollar value of closed deals (same signature; returns jsonb).
create or replace function public.group_totals(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'one_on_ones', (select count(*) from public.one_on_ones o
        where o.confirmed_at is not null and public.in_period(o.met_on, p_from, p_to)),
    'referrals', (select count(*) from public.referrals r where public.in_period(r.created_at, p_from, p_to)),
    'closed_deals', (select count(*) from public.referrals r where r.status = 'closed_deal'
        and public.in_period(r.closed_at, p_from, p_to)),
    'closed_amount', (select coalesce(sum(r.amount), 0) from public.referrals r where r.status = 'closed_deal'
        and public.in_period(r.closed_at, p_from, p_to)),
    'visitors', (select count(*) from public.guest_requests g
        where g.status in ('visited', 'applied', 'joined') and public.in_period(g.created_at, p_from, p_to))
  );
end $$;

-- Admins: dollar value of closed deals per member (given = referrals they passed, received = business they got).
create or replace function public.admin_member_amounts(p_from date default null, p_to date default null)
returns table (profile_id uuid, closed_amount_given numeric, closed_amount_received numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select p.id,
      (select coalesce(sum(r.amount), 0) from public.referrals r where r.from_id = p.id and r.status = 'closed_deal'
          and public.in_period(r.closed_at, p_from, p_to)),
      (select coalesce(sum(r.amount), 0) from public.referrals r where r.to_id = p.id and r.status = 'closed_deal'
          and public.in_period(r.closed_at, p_from, p_to))
    from public.profiles p where p.status = 'approved';
end $$;
revoke execute on function public.admin_member_amounts(date, date) from public, anon;
grant execute on function public.admin_member_amounts(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cancelled meetings stay listed
-- ---------------------------------------------------------------------------
alter table public.meetings
  add column cancelled_reason text check (cancelled_reason is null or char_length(cancelled_reason) between 2 and 120);
comment on column public.meetings.cancelled_reason is 'Set when a meeting is cancelled (e.g. "Thanksgiving holiday"); the meeting stays on the schedule, marked cancelled.';

-- Nobody but admins can sign up to speak at a cancelled meeting.
create or replace function public.guard_speaker_claim()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() and exists (select 1 from public.meetings m where m.id = new.meeting_id and m.cancelled_reason is not null) then
    raise exception 'this meeting is cancelled' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.guard_speaker_claim() from public, anon, authenticated;
create trigger meeting_speakers_not_cancelled before insert on public.meeting_speakers
  for each row execute function public.guard_speaker_claim();

-- ---------------------------------------------------------------------------
-- 3. One-on-one requests
-- ---------------------------------------------------------------------------
create table public.one_on_one_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  proposed_on date,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> invitee_id)
);
create index one_on_one_requests_requester_idx on public.one_on_one_requests (requester_id);
create index one_on_one_requests_invitee_idx on public.one_on_one_requests (invitee_id);

alter table public.one_on_one_requests enable row level security;
create policy oor_read on public.one_on_one_requests for select to authenticated
  using (requester_id = auth.uid() or invitee_id = auth.uid() or public.is_admin());
create policy oor_create on public.one_on_one_requests for insert to authenticated
  with check (public.is_approved_member() and requester_id = auth.uid() and status = 'pending' and responded_at is null
    and exists (select 1 from public.profiles p where p.id = invitee_id and p.status = 'approved'));
-- No update/delete policies: changes go through respond_one_on_one_request().

create or replace function public.limit_one_on_one_requests()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.one_on_one_requests r where r.requester_id = new.requester_id and r.status = 'pending') >= 10 then
    raise exception 'too many open requests' using errcode = '54000';
  end if;
  if exists (select 1 from public.one_on_one_requests r where r.requester_id = new.requester_id
             and r.invitee_id = new.invitee_id and r.status = 'pending') then
    raise exception 'you already have an open request with this member' using errcode = '23505';
  end if;
  return new;
end $$;
revoke execute on function public.limit_one_on_one_requests() from public, anon, authenticated;
create trigger one_on_one_requests_limit before insert on public.one_on_one_requests
  for each row execute function public.limit_one_on_one_requests();

-- The invitee accepts or declines; the requester cancels. Only pending requests change.
create or replace function public.respond_one_on_one_request(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.one_on_one_requests;
begin
  select * into r from public.one_on_one_requests where id = p_id for update;
  if r.id is null or r.status <> 'pending' then
    raise exception 'request not found or already answered' using errcode = 'P0002';
  end if;
  if p_status in ('accepted', 'declined') and r.invitee_id = auth.uid() then
    null;
  elsif p_status = 'cancelled' and r.requester_id = auth.uid() then
    null;
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.one_on_one_requests set status = p_status, responded_at = now() where id = p_id;
end $$;
revoke execute on function public.respond_one_on_one_request(uuid, text) from public, anon;
grant execute on function public.respond_one_on_one_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Slides: new agenda slides and extra text per slide
-- ---------------------------------------------------------------------------
alter table public.meeting_slide_settings drop constraint meeting_slide_settings_slides_check;
alter table public.meeting_slide_settings add constraint meeting_slide_settings_slides_check check (
  cardinality(slides) between 1 and 14
  and slides <@ array['welcome', 'networking', 'phones', 'introductions', 'roundtable', 'visitors', 'newcomers', 'asks',
                      'summary', 'leaderboards', 'five_minute', 'ten_minute', 'events', 'closing']::text[]
);
alter table public.meeting_slide_settings
  add column notes jsonb not null default '{}'::jsonb check (jsonb_typeof(notes) = 'object' and char_length(notes::text) <= 20000);
comment on column public.meeting_slide_settings.notes is 'Extra text an admin adds to slides: {"slide_key": "text"}';
