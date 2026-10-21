-- RSVP as a choice: "Can attend" / "Can't attend" (owner request 2026-10-21).
-- Additive: existing RSVP rows meant "going", so they default to attending = true.

alter table public.rsvps add column attending boolean not null default true;

-- Members may switch their own answer between the two choices.
create policy rsvps_update_own on public.rsvps for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.is_approved_member());
