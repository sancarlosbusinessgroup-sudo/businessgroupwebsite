-- Owner request 2026-10-31: an "Other" category for member events, with the host's own description of the event
-- type ("Other: Book club"). Existing events keep their category.
alter table public.member_events drop constraint member_events_category_check;
alter table public.member_events
  add constraint member_events_category_check check (category in ('Networking', 'Social', 'Workshop', 'Community', 'Other'));

alter table public.member_events
  add column category_other text check (category_other is null or char_length(trim(category_other)) between 2 and 60);
alter table public.member_events
  add constraint member_events_other_needs_text check (category <> 'Other' or category_other is not null);
