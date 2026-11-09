-- Owner 2026-11-10:
-- 1. Zoom-only visitors (no guest form, e.g. Geoff Weakley): admins can fill in their company, email and phone on
--    Admin → Attendance, next to "Invited by". Used by the Member and Management recaps and to send the recap.
-- 2. A saved list of extra addresses the Member recap is also sent to (Admin → Member recap).
-- Additive only. Access unchanged: zoom_participants is admin-only; email_settings admins read/update, no anon.
alter table public.zoom_participants
  add column visitor_business text check (char_length(visitor_business) <= 120),
  add column visitor_email text check (char_length(visitor_email) <= 254),
  add column visitor_phone text check (char_length(visitor_phone) <= 40);

alter table public.email_settings
  add column recap_extra_emails text[] not null default '{}' check (cardinality(recap_extra_emails) <= 100);
grant update (recap_extra_emails) on public.email_settings to authenticated;
