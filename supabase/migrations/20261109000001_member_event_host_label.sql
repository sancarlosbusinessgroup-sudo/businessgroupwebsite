-- Owner request 2026-11-09: a member event shows "Hosted by <the member's name>" by default, but the member can
-- change the displayed name (e.g. their business, or a co-host). Only the label changes: `host_id` still says who
-- posted and owns the event. Additive: existing events keep showing the poster's name.
alter table public.member_events add column host_label text
  check (host_label is null or char_length(trim(host_label)) between 2 and 80);
