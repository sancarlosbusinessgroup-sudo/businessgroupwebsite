-- Closed Businesses page (owner, 2026-10-25). Additive only: one new function, nothing dropped or changed.
--
-- Members sometimes forget to file a referral, and by the time they remember it has already become
-- business. They file it afterwards from the Closed Businesses page: it is saved as an ordinary referral
-- from them to the receiving member, already marked "closed business" (status closed_deal).
-- The normal insert policy keeps new slips at status 'new', so this goes through a checked function
-- instead of loosening that policy. closed_at is set by the existing referrals_prepare trigger.

create or replace function public.file_closed_business(
  p_to uuid,
  p_contact_name text,
  p_phone text,
  p_email text,
  p_amount numeric,
  p_notes text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_contact_name, ''));
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

  insert into public.referrals (from_id, to_id, contact_name, prospect_phone, prospect_email, amount, notes, status)
  values (
    auth.uid(), p_to, v_name,
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    p_amount,
    nullif(btrim(coalesce(p_notes, '')), ''),
    'closed_deal'
  )
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.file_closed_business(uuid, text, text, text, numeric, text) from public, anon;
grant execute on function public.file_closed_business(uuid, text, text, text, numeric, text) to authenticated;
