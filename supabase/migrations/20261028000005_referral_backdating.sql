-- Members may backdate a referral or a closed deal they forgot to file (owner, 2026-10-27).
-- The date referred (created_at) is set when the slip is filed; "closed on" (closed_at) is set by the receiving
-- member when they mark it closed business, or by the filer on the Closed Businesses page. Future dates are clamped
-- to now. Nothing else about who may change what has changed.

create or replace function public.prepare_referral()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_at is null or new.created_at > now() then
    new.created_at := now();
  end if;
  new.closed_at := case when new.status = 'closed_deal' then least(coalesce(new.closed_at, new.created_at), now()) end;
  return new;
end $$;

create or replace function public.guard_referral_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if (new.from_id is distinct from old.from_id and (new.from_id is not null or exists (select 1 from public.profiles where id = old.from_id)))
       or (new.to_id is distinct from old.to_id and (new.to_id is not null or exists (select 1 from public.profiles where id = old.to_id)))
       or new.contact_name is distinct from old.contact_name or new.created_at is distinct from old.created_at then
      raise exception 'you cannot change who is on a referral or the prospect name' using errcode = '42501';
    end if;
    if auth.uid() is not distinct from old.from_id and auth.uid() is distinct from old.to_id and new.status is distinct from old.status then
      raise exception 'only the receiving member can update status' using errcode = '42501';
    end if;
  end if;
  if new.created_at > now() then
    new.created_at := now();
  end if;
  if new.status = 'closed_deal' then
    -- A "closed on" date sent with the update wins; otherwise keep the existing one, or stamp now.
    new.closed_at := least(coalesce(case when new.closed_at is distinct from old.closed_at then new.closed_at end, old.closed_at, now()), now());
  else
    new.closed_at := null;
  end if;
  return new;
end $$;

-- Closed Businesses page: optional "closed on" date (the referral is dated the same day). A new name rather than
-- an overload, so the old six-argument function can stay (no drop) and PostgREST never sees an ambiguous call.
create or replace function public.file_closed_business_on(
  p_to uuid,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_amount numeric,
  p_notes text,
  p_closed_on date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_contact_name, ''));
  v_when timestamptz := least(coalesce((p_closed_on::timestamp + interval '12 hours') at time zone 'America/Los_Angeles', now()), now());
begin
  if auth.uid() is null or not public.is_approved_member() then
    raise exception 'only approved members can file closed business' using errcode = '42501';
  end if;
  if p_to is null or p_to = auth.uid() then
    raise exception 'choose another member' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_to and p.status = 'approved') then
    raise exception 'choose an approved member' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'the name of the referral must be 2 to 120 characters' using errcode = '22023';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'the value cannot be negative' using errcode = '22023';
  end if;

  insert into public.referrals (from_id, to_id, contact_name, prospect_phone, prospect_email, amount, notes, status, created_at, closed_at)
  values (
    auth.uid(), p_to, v_name,
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    p_amount,
    nullif(btrim(coalesce(p_notes, '')), ''),
    'closed_deal',
    v_when,
    v_when
  )
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.file_closed_business_on(uuid, text, text, text, numeric, text, date) from public, anon;
grant execute on function public.file_closed_business_on(uuid, text, text, text, numeric, text, date) to authenticated;
