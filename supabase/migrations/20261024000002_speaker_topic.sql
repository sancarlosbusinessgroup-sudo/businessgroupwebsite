-- Presentation titles (owner request 2026-10-24). Additive: one new function, nothing changed or removed.
-- The 5- and 10-minute slides show the topic the presenter wrote on the Meetings page. Presenters can now write or
-- change that topic after claiming (or after an admin put them in the slot without one). Only the topic and the
-- short description change; admins can still edit everything through their existing policy.

create or replace function public.set_speaker_topic(p_meeting uuid, p_slot text, p_topic text, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t text := btrim(coalesce(p_topic, ''));
  d text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if auth.uid() is null then raise exception 'Please log in again'; end if;
  if char_length(t) < 3 or char_length(t) > 120 then raise exception 'The topic must be 3 to 120 characters'; end if;
  if d is not null and char_length(d) > 500 then raise exception 'Keep the description under 500 characters'; end if;
  update public.meeting_speakers s
     set topic = t, topic_description = d
   where s.meeting_id = p_meeting and s.slot::text = p_slot and s.profile_id = auth.uid()
     and exists (select 1 from public.meetings m where m.id = p_meeting and m.starts_at > now() - interval '3 hours');
  if not found then raise exception 'You can only change the topic of your own upcoming presentation'; end if;
end $$;

revoke all on function public.set_speaker_topic(uuid, text, text, text) from public, anon;
grant execute on function public.set_speaker_topic(uuid, text, text, text) to authenticated;
