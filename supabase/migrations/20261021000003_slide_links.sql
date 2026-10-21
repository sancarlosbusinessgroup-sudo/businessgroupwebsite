-- Owner request 2026-10-21: presentations can include website links (shown inside the slide), not only YouTube.
-- Additive only: a new table with the same access rules as meeting_slide_media.
create table public.meeting_slide_links (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  url text not null check (char_length(url) <= 2000 and url ~ '^https://[^\s/$.?#][^\s]*$'),
  title text check (char_length(title) <= 120),
  after_slide text not null check (after_slide ~ '^[a-z_]{2,30}$'),
  sort smallint not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index meeting_slide_links_meeting_idx on public.meeting_slide_links (meeting_id, sort);
alter table public.meeting_slide_links enable row level security;
create policy slide_links_members_read on public.meeting_slide_links for select to authenticated
  using (public.is_approved_member());
create policy slide_links_admin_insert on public.meeting_slide_links for insert to authenticated
  with check (public.is_admin());
create policy slide_links_admin_update on public.meeting_slide_links for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy slide_links_admin_delete on public.meeting_slide_links for delete to authenticated
  using (public.is_admin());
revoke all on public.meeting_slide_links from anon;
