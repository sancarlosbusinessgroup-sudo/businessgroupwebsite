-- Owner request 2026-10-23: members delete the referral slips they filed (any status, not only "new"); admins delete any.
-- Replaces one policy (drop + create, same name). Plus indexes on foreign keys the Supabase advisor flagged (additive).

drop policy referrals_delete on public.referrals;
create policy referrals_delete on public.referrals for delete to authenticated
  using (from_id = (select auth.uid()) or public.is_admin());

create index if not exists attendance_profile_idx on public.attendance (profile_id);
create index if not exists attendance_corrections_profile_idx on public.attendance_corrections (profile_id);
create index if not exists attendance_corrections_meeting_idx on public.attendance_corrections (meeting_id);
create index if not exists rsvps_profile_idx on public.rsvps (profile_id);
create index if not exists meeting_speakers_profile_idx on public.meeting_speakers (profile_id);
create index if not exists guest_requests_meeting_idx on public.guest_requests (meeting_id);
create index if not exists zoom_participants_profile_idx on public.zoom_participants (profile_id);
create index if not exists zoom_participants_guest_idx on public.zoom_participants (guest_id);
create index if not exists zoom_aliases_profile_idx on public.zoom_aliases (profile_id);
create index if not exists email_log_profile_idx on public.email_log (profile_id);
create index if not exists directory_downloads_profile_idx on public.directory_downloads (profile_id);
