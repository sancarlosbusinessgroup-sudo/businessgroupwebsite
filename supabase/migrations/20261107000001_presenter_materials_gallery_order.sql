-- Owner requests 2026-11-07. Additive only: new policies, two new functions, one new column, and the gallery's
-- change-history trigger re-created so it ignores a pure re-order. No data is changed or removed.
--
-- 1. Presenters add their own materials (image, PDF, PowerPoint, YouTube video or website) for the 5- or 10-minute
--    presentation they hold, from the Meetings page, until the meeting starts. They can remove what they added
--    (until the meeting starts). Admins keep full control through their existing policies.
-- 2. Admins can put the gallery photos in any order.

-- ---------------------------------------------------------------------------
-- 1. Presenter materials
-- ---------------------------------------------------------------------------

-- True when the signed-in approved member holds the presentation slot that `p_after` belongs to
-- ('five_minute' = the 5-minute slot, 'ten_minute' = the 10-minute slot) at a meeting that hasn't started yet.
create or replace function public.holds_presentation(p_meeting uuid, p_after text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and public.is_approved_member()
     and p_after in ('five_minute', 'ten_minute')
     and exists (
       select 1
         from public.meeting_speakers s
         join public.meetings m on m.id = s.meeting_id
        where s.meeting_id = p_meeting
          and s.profile_id = auth.uid()
          and s.slot = case p_after when 'five_minute' then 'education'::public.speaker_slot else 'presentation'::public.speaker_slot end
          and m.starts_at > now()
     )
$$;
revoke all on function public.holds_presentation(uuid, text) from public, anon;
grant execute on function public.holds_presentation(uuid, text) to authenticated;

-- Same check for a storage file path "<meeting id>/<member id>/<file>": the member's own folder in a meeting
-- where they hold either presentation slot and that hasn't started yet.
create or replace function public.can_upload_presenter_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and public.is_approved_member()
     and (storage.foldername(p_name))[2] = auth.uid()::text
     and array_length(storage.foldername(p_name), 1) = 2
     and exists (
       select 1
         from public.meeting_speakers s
         join public.meetings m on m.id = s.meeting_id
        where m.id::text = (storage.foldername(p_name))[1]
          and s.profile_id = auth.uid()
          and m.starts_at > now()
     )
$$;
revoke all on function public.can_upload_presenter_file(text) from public, anon;
grant execute on function public.can_upload_presenter_file(text) to authenticated;

drop policy if exists slide_media_presenter_insert on public.meeting_slide_media;
create policy slide_media_presenter_insert on public.meeting_slide_media for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.holds_presentation(meeting_id, after_slide)
    and (storage_path is null or storage_path like meeting_id::text || '/' || auth.uid()::text || '/%')
  );
drop policy if exists slide_media_presenter_delete on public.meeting_slide_media;
create policy slide_media_presenter_delete on public.meeting_slide_media for delete to authenticated
  using (created_by = auth.uid() and public.holds_presentation(meeting_id, after_slide));

drop policy if exists slide_links_presenter_insert on public.meeting_slide_links;
create policy slide_links_presenter_insert on public.meeting_slide_links for insert to authenticated
  with check (created_by = auth.uid() and public.holds_presentation(meeting_id, after_slide));
drop policy if exists slide_links_presenter_delete on public.meeting_slide_links;
create policy slide_links_presenter_delete on public.meeting_slide_links for delete to authenticated
  using (created_by = auth.uid() and public.holds_presentation(meeting_id, after_slide));

drop policy if exists slide_media_storage_presenter_insert on storage.objects;
create policy slide_media_storage_presenter_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'slide-media' and public.can_upload_presenter_file(name));
drop policy if exists slide_media_storage_presenter_delete on storage.objects;
create policy slide_media_storage_presenter_delete on storage.objects for delete to authenticated
  using (bucket_id = 'slide-media' and public.can_upload_presenter_file(name));

-- ---------------------------------------------------------------------------
-- 2. Gallery order
-- ---------------------------------------------------------------------------

-- Lower numbers show first. New photos get 0, so they appear at the top until an admin moves them.
alter table public.gallery_photos add column if not exists sort_order integer not null default 0;

-- Change history: record caption/album/date/photo changes and removals, but not a re-order (which renumbers
-- many photos at once and would flood the history).
drop trigger if exists audit_gallery_photos on public.gallery_photos;
create trigger audit_gallery_photos
  after update of album, caption, taken_on, image_path, thumb_path, uploaded_by or delete on public.gallery_photos
  for each row execute function public.log_admin_change('uploaded_by');

-- Admins save the whole order at once: p_ids lists photo ids first to last. Runs with the admin's own rights
-- (their existing update policy), and only touches photos whose position actually changes.
create or replace function public.admin_reorder_gallery(p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only admins can reorder the gallery'; end if;
  update public.gallery_photos g
     set sort_order = x.ord
    from unnest(p_ids) with ordinality as x(id, ord)
   where g.id = x.id and g.sort_order is distinct from x.ord::integer;
end $$;
revoke all on function public.admin_reorder_gallery(uuid[]) from public, anon;
grant execute on function public.admin_reorder_gallery(uuid[]) to authenticated;
