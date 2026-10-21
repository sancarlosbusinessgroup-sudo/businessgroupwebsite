-- Owner request 2026-10-22: turn the timers on or off per slide (and on the presenters' added slides), per meeting.
-- Additive: one new column. {"five_qa": false} hides that timer; a missing key means the timer shows.
alter table public.meeting_slide_settings
  add column timers jsonb not null default '{}'::jsonb check (jsonb_typeof(timers) = 'object' and char_length(timers::text) <= 1000);
comment on column public.meeting_slide_settings.timers is 'Timers turned off for this meeting, e.g. {"five_qa": false, "five_materials": false}. Missing key = timer shown.';
