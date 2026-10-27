-- Site audit, 2026-10-27: column-level grants.
-- Visitors (anon) could read every profiles column, including referral_code and role; members could update
-- member_contacts.email directly. Row policies already limit WHICH rows are visible; these grants limit WHICH COLUMNS.
--
-- APPLY ONLY AFTER the code that reads named columns (getMemberBySlug) is live: PostgREST expands `select *`
-- to every column, and a `*` read by anon would fail once these grants are in place.

-- Profiles: visitors see only what the directory and a public profile page show.
revoke select on public.profiles from anon;
grant select (
  id, slug, first_name, last_name, business_name, category_id, city, service_area, about, ideal_client, listen_for,
  services, website, logo_path, avatar_path, approved_at, member_since, weekly_ask, weekly_ask_updated_at,
  show_in_directory, show_phone_public, status, role, created_at
) on public.profiles to anon;
-- Visitors never write profiles.
revoke insert, update, delete on public.profiles from anon;

-- Contact details: members may update the phone; the sign-in email changes only through the email-change flow.
revoke update on public.member_contacts from authenticated;
grant update (phone) on public.member_contacts to authenticated;
revoke all on public.member_contacts from anon;

-- Rollback (if ever needed):
--   grant select on public.profiles to anon;
--   grant update on public.member_contacts to authenticated;
