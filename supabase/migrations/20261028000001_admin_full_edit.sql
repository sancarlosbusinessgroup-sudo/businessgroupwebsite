-- Admin full-edit capability (owner decisions, 2026-10-27):
--   * every admin can edit any member's profile, contact phone, presentation slots, meetings and anything members post;
--   * only "owners" (Viv, Ced, Rachanee, Shermaine) can add or remove admins; nobody can change their own role;
--   * admins may change a member's phone but not their sign-in email (that goes through the verified email-change flow);
--   * every admin change to someone else's data is recorded in admin_audit_log (admins only).
-- Additive: no table, column or row is dropped.

-- ---------------------------------------------------------------------------
-- 1. Owners
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_owner boolean not null default false;
comment on column public.profiles.is_owner is 'Owners may grant or revoke the admin role. Set by the site operator only.';

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.role = 'admin' and p.is_owner
  );
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

update public.profiles p set is_owner = true, role = 'admin'
 where p.id in (
   select c.profile_id from public.member_contacts c
    where lower(c.email) in ('viv@vabrato.com', 'cedrick@vabrato.com', 'rachanee.munar@vserve-trading.com', 'shermaine@vabrato.com')
 );

-- ---------------------------------------------------------------------------
-- 2. Profile guard: role changes are for owners; nobody edits their own role; the owner flag is read-only here.
--    Members still cannot change membership fields, and now also not their slug or guest-visit count.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new; -- service role / internal
  end if;
  if new.is_owner is distinct from old.is_owner then
    raise exception 'owners are set by the site operator' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    if not public.is_owner() then
      raise exception 'only owners can add or remove admins' using errcode = '42501';
    end if;
    if old.id = auth.uid() then
      raise exception 'you cannot change your own admin role' using errcode = '42501';
    end if;
    if old.is_owner and new.role <> 'admin' then
      raise exception 'owners stay admins' using errcode = '42501';
    end if;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.referral_code is distinct from old.referral_code
     or new.referred_by is distinct from old.referred_by
     or new.approved_at is distinct from old.approved_at
     or new.member_since is distinct from old.member_since
     or new.slug is distinct from old.slug
     or new.guest_meetings_attended is distinct from old.guest_meetings_attended then
    raise exception 'not allowed to change membership fields' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Contact details: admins may edit the phone; the sign-in email changes only through the email-change flow
--    (service role), never by a direct update from a logged-in user.
-- ---------------------------------------------------------------------------
drop policy if exists contacts_admin_update on public.member_contacts;
create policy contacts_admin_update on public.member_contacts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_contact_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email then
    raise exception 'the sign-in email changes through the email-change flow' using errcode = '42501';
  end if;
  if new.profile_id is distinct from old.profile_id then
    raise exception 'contact rows cannot be moved' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.guard_contact_email() from public, anon, authenticated;
drop trigger if exists member_contacts_guard on public.member_contacts;
create trigger member_contacts_guard before update on public.member_contacts
  for each row execute function public.guard_contact_email();

-- ---------------------------------------------------------------------------
-- 4. Policies admins were missing: one-on-one requests, RSVPs, gallery captions.
-- ---------------------------------------------------------------------------
drop policy if exists oor_admin_update on public.one_on_one_requests;
create policy oor_admin_update on public.one_on_one_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists oor_admin_delete on public.one_on_one_requests;
create policy oor_admin_delete on public.one_on_one_requests for delete to authenticated
  using (public.is_admin());

drop policy if exists rsvps_admin_write on public.rsvps;
create policy rsvps_admin_write on public.rsvps for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists gallery_admin_update on public.gallery_photos;
create policy gallery_admin_update on public.gallery_photos for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Change history: what admins changed on other people's data.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  row_id text,
  subject_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
comment on table public.admin_audit_log is 'Every change an admin makes to someone else''s data (who, what, before, after, when). Admins only.';
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_subject_idx on public.admin_audit_log (subject_id, created_at desc);
create index if not exists admin_audit_log_actor_idx on public.admin_audit_log (actor_id);

alter table public.admin_audit_log enable row level security;
drop policy if exists audit_admin_read on public.admin_audit_log;
create policy audit_admin_read on public.admin_audit_log for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: rows are written by the trigger below (security definer) only.
revoke all on public.admin_audit_log from anon;
grant select on public.admin_audit_log to authenticated;

-- TG_ARGV[0] = the column naming the member the row belongs to ('' when the row belongs to nobody, e.g. meetings).
create or replace function public.log_admin_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_owner_col text := coalesce(tg_argv[0], '');
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_subject uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor is null or not public.is_admin() then
    return null; -- members and the service role are not admins acting on others
  end if;
  if v_owner_col <> '' then
    v_subject := nullif(v_row ->> v_owner_col, '')::uuid;
    if v_subject = v_actor then
      return null; -- admins editing their own data: not someone else's
    end if;
  end if;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(e.key, e.value) into v_before
      from jsonb_each(v_old) e where v_new -> e.key is distinct from e.value and e.key <> 'updated_at';
    select jsonb_object_agg(e.key, e.value) into v_after
      from jsonb_each(v_new) e where v_old -> e.key is distinct from e.value and e.key <> 'updated_at';
    if v_before is null and v_after is null then
      return null; -- nothing actually changed
    end if;
  else
    v_before := v_old;
    v_after := v_new;
  end if;
  insert into public.admin_audit_log (actor_id, action, table_name, row_id, subject_id, before, after)
  values (
    v_actor,
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', concat_ws(':', v_row ->> 'meeting_id', v_row ->> 'profile_id', v_row ->> 'slot')),
    v_subject,
    v_before,
    v_after
  );
  return null;
end $$;
revoke execute on function public.log_admin_change() from public, anon, authenticated;

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after update or delete on public.profiles
  for each row execute function public.log_admin_change('id');
drop trigger if exists audit_member_contacts on public.member_contacts;
create trigger audit_member_contacts after update on public.member_contacts
  for each row execute function public.log_admin_change('profile_id');
drop trigger if exists audit_meetings on public.meetings;
create trigger audit_meetings after insert or update or delete on public.meetings
  for each row execute function public.log_admin_change('');
drop trigger if exists audit_meeting_links on public.meeting_links;
create trigger audit_meeting_links after insert or update or delete on public.meeting_links
  for each row execute function public.log_admin_change('');
drop trigger if exists audit_meeting_speakers on public.meeting_speakers;
create trigger audit_meeting_speakers after insert or update or delete on public.meeting_speakers
  for each row execute function public.log_admin_change('profile_id');
drop trigger if exists audit_member_events on public.member_events;
create trigger audit_member_events after update or delete on public.member_events
  for each row execute function public.log_admin_change('host_id');
drop trigger if exists audit_gallery_photos on public.gallery_photos;
create trigger audit_gallery_photos after update or delete on public.gallery_photos
  for each row execute function public.log_admin_change('uploaded_by');
drop trigger if exists audit_referrals on public.referrals;
create trigger audit_referrals after update or delete on public.referrals
  for each row execute function public.log_admin_change('from_id');
drop trigger if exists audit_one_on_ones on public.one_on_ones;
create trigger audit_one_on_ones after update or delete on public.one_on_ones
  for each row execute function public.log_admin_change('reporter_id');
drop trigger if exists audit_one_on_one_requests on public.one_on_one_requests;
create trigger audit_one_on_one_requests after update or delete on public.one_on_one_requests
  for each row execute function public.log_admin_change('requester_id');
drop trigger if exists audit_rsvps on public.rsvps;
create trigger audit_rsvps after insert or update or delete on public.rsvps
  for each row execute function public.log_admin_change('profile_id');
