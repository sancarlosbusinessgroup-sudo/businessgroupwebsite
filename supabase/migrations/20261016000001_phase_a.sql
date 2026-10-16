-- Phase A (docs/phase-2-spec.md). Drops approved by the owner on 2026-10-16:
--   one_on_one_feedback.rating, referrals.closed_amount, profiles.show_stats,
--   member_stats / monthly_activity / group_month_stats / top_inviters / public_member_stats,
--   confirm_one_on_one(uuid, smallint), index profiles_one_per_category.

-- ---------------------------------------------------------------------------
-- 1. One-on-ones without star ratings
-- ---------------------------------------------------------------------------
alter table public.one_on_one_feedback drop column rating;

drop function public.confirm_one_on_one(uuid, smallint);
create function public.confirm_one_on_one(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  update public.one_on_ones set confirmed_at = coalesce(confirmed_at, now())
   where id = p_id and partner_id = auth.uid();
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.confirm_one_on_one(uuid) from public, anon;
grant execute on function public.confirm_one_on_one(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Referral slips: business passed to another member. Counts only, no amounts.
-- ---------------------------------------------------------------------------
alter type public.referral_status rename value 'sent' to 'new';
alter type public.referral_status rename value 'closed' to 'closed_deal';
alter type public.referral_status add value 'meeting_set' after 'contacted';
alter type public.referral_warmth rename value 'tip' to 'cold';

alter table public.referrals drop column closed_amount;
alter table public.referrals
  add column prospect_phone text check (prospect_phone is null or char_length(prospect_phone) between 7 and 25),
  add column prospect_email text check (prospect_email is null or (prospect_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(prospect_email) <= 254)),
  add column prospect_consent boolean not null default false,
  add column closed_at timestamptz;
comment on column public.referrals.contact_name is 'Prospect name';
comment on column public.referrals.closed_at is 'When the receiver marked it a closed deal (set by trigger)';

-- Existing closed referrals: best available date is the last update (triggers off so updated_at is kept).
alter table public.referrals disable trigger referrals_guard;
alter table public.referrals disable trigger referrals_touch;
update public.referrals set closed_at = updated_at where status = 'closed_deal';
alter table public.referrals enable trigger referrals_guard;
alter table public.referrals enable trigger referrals_touch;
create index referrals_closed_at_idx on public.referrals (closed_at) where closed_at is not null;
create index referrals_created_at_idx on public.referrals (created_at);

-- Who may change what. Receiver: status. Giver: notes / prospect details. Nobody: parties, prospect name, dates.
create or replace function public.guard_referral_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if new.from_id is distinct from old.from_id or new.to_id is distinct from old.to_id
       or new.contact_name is distinct from old.contact_name or new.created_at is distinct from old.created_at then
      raise exception 'you cannot change who is on a referral or the prospect name' using errcode = '42501';
    end if;
    if auth.uid() = old.from_id and auth.uid() <> old.to_id and new.status is distinct from old.status then
      raise exception 'only the receiving member can update status' using errcode = '42501';
    end if;
  end if;
  -- closed_at always follows the status; it cannot be set by hand.
  if new.status = 'closed_deal' then
    new.closed_at := case when old.status = 'closed_deal' then old.closed_at else now() end;
  else
    new.closed_at := null;
  end if;
  return new;
end $$;

-- New slips never start closed.
create or replace function public.prepare_referral()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.closed_at := case when new.status = 'closed_deal' then now() end;
  return new;
end $$;
create trigger referrals_prepare before insert on public.referrals
  for each row execute function public.prepare_referral();
revoke execute on function public.prepare_referral() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Stats. Per-member: admins only. Members: leaderboard (names + counts) and group totals.
--    Ranges are Pacific calendar dates; p_from inclusive, p_to exclusive; null = open-ended.
--    Rules: one-on-one counts for both members once confirmed (met_on); referral counts for the giver
--    when filed (created_at); closed deal counts for the giver (closed_at) and as "received" for the receiver;
--    visitors brought = guest requests credited to the member who actually visited (or went further).
-- ---------------------------------------------------------------------------
drop function public.member_stats(uuid);
drop function public.monthly_activity();
drop function public.group_month_stats();
drop function public.top_inviters(int);
drop function public.public_member_stats(text);
alter table public.profiles drop column show_stats;

create or replace function public.in_period(p_ts timestamptz, p_from date, p_to date)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from is null or (p_ts at time zone 'America/Los_Angeles')::date >= p_from)
     and (p_to is null or (p_ts at time zone 'America/Los_Angeles')::date < p_to);
$$;
create or replace function public.in_period(p_day date, p_from date, p_to date)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from is null or p_day >= p_from) and (p_to is null or p_day < p_to);
$$;
revoke execute on function public.in_period(timestamptz, date, date) from public, anon, authenticated;
revoke execute on function public.in_period(date, date, date) from public, anon, authenticated;

-- Internal: per-member counts with no permission check (callers check).
create or replace function public.period_counts(p_from date, p_to date)
returns table (
  profile_id uuid, first_name text, last_name text, business_name text,
  one_on_ones bigint, referrals_given bigint, referrals_received bigint,
  closed_deals bigint, closed_deals_received bigint, visitors_brought bigint
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.last_name, p.business_name,
    (select count(*) from public.one_on_ones o
      where (o.reporter_id = p.id or o.partner_id = p.id) and o.confirmed_at is not null
        and public.in_period(o.met_on, p_from, p_to)),
    (select count(*) from public.referrals r where r.from_id = p.id and public.in_period(r.created_at, p_from, p_to)),
    (select count(*) from public.referrals r where r.to_id = p.id and public.in_period(r.created_at, p_from, p_to)),
    (select count(*) from public.referrals r where r.from_id = p.id and r.status = 'closed_deal'
        and public.in_period(r.closed_at, p_from, p_to)),
    (select count(*) from public.referrals r where r.to_id = p.id and r.status = 'closed_deal'
        and public.in_period(r.closed_at, p_from, p_to)),
    (select count(*) from public.guest_requests g where g.referrer_id = p.id
        and g.status in ('visited', 'applied', 'joined') and public.in_period(g.created_at, p_from, p_to))
  from public.profiles p
  where p.status = 'approved';
$$;
revoke execute on function public.period_counts(date, date) from public, anon, authenticated;

create or replace function public.admin_member_stats(p_from date default null, p_to date default null)
returns table (
  profile_id uuid, first_name text, last_name text, business_name text,
  one_on_ones bigint, referrals_given bigint, referrals_received bigint,
  closed_deals bigint, closed_deals_received bigint, visitors_brought bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query select * from public.period_counts(p_from, p_to) c order by c.first_name, c.last_name;
end $$;

create or replace function public.leaderboard(p_from date default null, p_to date default null, p_limit int default 5)
returns table (metric text, rank int, profile_id uuid, first_name text, last_name text, value bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_approved_member() then
    raise exception 'members only' using errcode = '42501';
  end if;
  return query
  with c as (select * from public.period_counts(p_from, p_to)),
  m as (
    select 'one_on_ones'::text as metric, c.profile_id, c.first_name, c.last_name, c.one_on_ones as value from c
    union all select 'referrals', c.profile_id, c.first_name, c.last_name, c.referrals_given from c
    union all select 'closed_deals', c.profile_id, c.first_name, c.last_name, c.closed_deals from c
    union all select 'visitors', c.profile_id, c.first_name, c.last_name, c.visitors_brought from c
  ),
  ranked as (
    select m.*, row_number() over (partition by m.metric order by m.value desc, m.first_name, m.last_name)::int as rn
    from m where m.value > 0
  )
  select r.metric, r.rn, r.profile_id, r.first_name, r.last_name, r.value
  from ranked r
  where r.rn <= least(greatest(coalesce(p_limit, 5), 1), 20)
  order by array_position(array['one_on_ones', 'referrals', 'closed_deals', 'visitors'], r.metric), r.rn;
end $$;

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
    'visitors', (select count(*) from public.guest_requests g
        where g.status in ('visited', 'applied', 'joined') and public.in_period(g.created_at, p_from, p_to))
  );
end $$;

revoke execute on function public.admin_member_stats(date, date) from public, anon;
revoke execute on function public.leaderboard(date, date, int) from public, anon;
revoke execute on function public.group_totals(date, date) from public, anon;
grant execute on function public.admin_member_stats(date, date) to authenticated;
grant execute on function public.leaderboard(date, date, int) to authenticated;
grant execute on function public.group_totals(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Management (About page)
-- ---------------------------------------------------------------------------
create table public.leadership (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  role text not null check (char_length(role) between 2 and 80),
  bio text check (char_length(bio) <= 1000),
  photo_path text check (char_length(photo_path) <= 200),
  profile_id uuid references public.profiles (id) on delete set null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leadership_sort_idx on public.leadership (sort_order, name);
create trigger leadership_touch before update on public.leadership
  for each row execute function public.touch_updated_at();

alter table public.leadership enable row level security;
create policy leadership_read on public.leadership for select to anon, authenticated using (true);
create policy leadership_admin_write on public.leadership for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Directory downloads (members only; logged for admins)
-- ---------------------------------------------------------------------------
create table public.directory_downloads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  format text not null check (format in ('csv', 'vcf')),
  created_at timestamptz not null default now()
);
create index directory_downloads_created_idx on public.directory_downloads (created_at desc);

alter table public.directory_downloads enable row level security;
create policy downloads_insert_own on public.directory_downloads for insert to authenticated
  with check (profile_id = auth.uid() and public.is_approved_member());
create policy downloads_read on public.directory_downloads for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Weekly specific ask (A3)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column weekly_ask text check (char_length(weekly_ask) <= 160),
  add column weekly_ask_updated_at timestamptz;

create or replace function public.stamp_weekly_ask()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.weekly_ask is distinct from old.weekly_ask then
    new.weekly_ask := nullif(trim(new.weekly_ask), '');
    new.weekly_ask_updated_at := case when new.weekly_ask is null then null else now() end;
  else
    new.weekly_ask_updated_at := old.weekly_ask_updated_at;
  end if;
  return new;
end $$;
create trigger profiles_stamp_weekly_ask before update on public.profiles
  for each row execute function public.stamp_weekly_ask();
revoke execute on function public.stamp_weekly_ask() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Open categories (A1): seat_limit replaces the one-per-category unique index.
-- ---------------------------------------------------------------------------
alter table public.categories add column seat_limit smallint not null default 1 check (seat_limit between 1 and 99);
drop index public.profiles_one_per_category;

create or replace function public.check_category_seats()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit smallint;
  v_taken int;
begin
  if new.status <> 'approved' or new.category_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'approved' and old.category_id is not distinct from new.category_id then
    return new;
  end if;
  -- serialise concurrent approvals into the same category
  select c.seat_limit into v_limit from public.categories c where c.id = new.category_id for update;
  select count(*) into v_taken from public.profiles p
   where p.category_id = new.category_id and p.status = 'approved' and p.id <> new.id;
  if v_taken >= v_limit then
    raise exception 'category is full' using errcode = '23505', hint = 'category_full';
  end if;
  return new;
end $$;
create trigger profiles_category_seats before insert or update of status, category_id on public.profiles
  for each row execute function public.check_category_seats();
revoke execute on function public.check_category_seats() from public, anon, authenticated;

create or replace function public.open_categories()
returns table (id smallint, name text, seat_limit smallint, taken bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.seat_limit,
    (select count(*) from public.profiles p where p.category_id = c.id and p.status = 'approved')
  from public.categories c
  order by c.name;
$$;
grant execute on function public.open_categories() to anon, authenticated;
