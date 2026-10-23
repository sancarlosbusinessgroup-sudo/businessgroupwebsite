-- Guests can give a phone number and website when they request an invite (owner request 2026-10-24),
-- so the meeting recap can introduce today's visitors the way the group always has. Additive.

alter table public.guest_requests
  add column phone text check (phone is null or char_length(phone) between 7 and 40),
  add column website text check (website is null or (char_length(website) <= 300 and website ~* '^https?://'));
