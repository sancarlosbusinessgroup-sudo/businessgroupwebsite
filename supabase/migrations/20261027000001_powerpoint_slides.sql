-- PowerPoint files as presenter materials (owner request 2026-10-27).
-- Changes: one check constraint is replaced to allow kind 'powerpoint' (no data removed), and the private
-- slide-media bucket also accepts .ppt / .pptx files. Nothing else changes.

alter table public.meeting_slide_media drop constraint meeting_slide_media_kind_check;
alter table public.meeting_slide_media add constraint meeting_slide_media_kind_check
  check (kind in ('image', 'pdf', 'youtube', 'powerpoint'));

update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
     'application/vnd.ms-powerpoint',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation'
   ]
 where id = 'slide-media';
