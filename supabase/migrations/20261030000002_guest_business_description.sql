-- Owner request 2026-10-30. Additive only (one new column).
--
-- Guest invite request: "Tell us about your business" — a short description of the guest's business, industry and
-- services so management can spot a category overlap or conflict with an existing member before approving the visit.
-- Grants on guest_requests are table-wide, so anon inserts and admin reads pick the column up without new grants.
alter table public.guest_requests
  add column business_description text check (char_length(business_description) <= 1000);
