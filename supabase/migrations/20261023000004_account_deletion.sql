-- Members can delete their own account (owner chose "Option A", 2026-10-23): the person is removed, but referral slips and
-- one-on-ones they shared with other members stay, shown as "Former member", so others' histories and group stats are kept.
-- Changes four foreign keys from "delete with the member" to "keep, set to empty". Nothing else is removed.
alter table public.referrals alter column from_id drop not null, alter column to_id drop not null;
alter table public.referrals drop constraint referrals_from_id_fkey,
  add constraint referrals_from_id_fkey foreign key (from_id) references public.profiles (id) on delete set null;
alter table public.referrals drop constraint referrals_to_id_fkey,
  add constraint referrals_to_id_fkey foreign key (to_id) references public.profiles (id) on delete set null;

alter table public.one_on_ones alter column reporter_id drop not null, alter column partner_id drop not null;
alter table public.one_on_ones drop constraint one_on_ones_reporter_id_fkey,
  add constraint one_on_ones_reporter_id_fkey foreign key (reporter_id) references public.profiles (id) on delete set null;
alter table public.one_on_ones drop constraint one_on_ones_partner_id_fkey,
  add constraint one_on_ones_partner_id_fkey foreign key (partner_id) references public.profiles (id) on delete set null;

-- The referral guard refuses changes to who is on a slip; let the "set to empty" from a deleted account through.
create or replace function public.guard_referral_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    -- Emptying a party is allowed only when that member's profile is gone (account deleted).
    if (new.from_id is distinct from old.from_id and (new.from_id is not null or exists (select 1 from public.profiles where id = old.from_id)))
       or (new.to_id is distinct from old.to_id and (new.to_id is not null or exists (select 1 from public.profiles where id = old.to_id)))
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
