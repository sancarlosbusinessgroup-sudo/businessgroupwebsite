-- Owner requests 2026-10-30. Additive only (two new columns, one column grant).
--
-- 1. Visitor sign-in link: visitors who join a meeting on Zoom without having asked for an invite open a link that
--    management pastes in the Zoom chat and enter their details. Their guest request is marked "meeting_sign_in" so the
--    admin guest list can show "Signed in at the meeting". The site sets it with the service role after the visitor's
--    insert; ordinary invite requests keep the default 'website'.
alter table public.guest_requests
  add column source text not null default 'website' check (source in ('website', 'meeting_sign_in'));

-- 2. Management recap: an attendance email to every admin after each meeting, with its own on/off switch on
--    Admin → Management recap (the existing switch stays for the Member recap).
alter table public.email_settings
  add column management_recaps_enabled boolean not null default true;

grant update (management_recaps_enabled) on public.email_settings to authenticated;
