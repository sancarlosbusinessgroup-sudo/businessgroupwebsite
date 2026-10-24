-- Guest invite requests (owner requests 2026-10-24). Additive.
-- Guests can give a phone number and website when they request an invite, so the meeting recap can introduce
-- today's visitors the way the group always has, and admins see the phone on the guest list.
-- Admins mark when a guest's one-on-ones with the leadership team are done.

alter table public.guest_requests
  add column phone text check (phone is null or char_length(phone) between 7 and 40),
  add column website text check (website is null or (char_length(website) <= 300 and website ~* '^https?://')),
  add column one_on_ones_done_at timestamptz;

-- Visitors cannot set the one-on-ones mark themselves (only admins update guest requests).
create or replace function public.guest_requests_no_self_marks()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.one_on_ones_done_at := null;
  return new;
end $$;
create trigger guest_requests_no_self_marks before insert on public.guest_requests
  for each row execute function public.guest_requests_no_self_marks();
