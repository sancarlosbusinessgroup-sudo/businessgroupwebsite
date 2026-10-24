-- One-on-one requests: "Send a message" (owner request 2026-10-24). Additive: two new columns and one new function.
-- The member who receives a request can Accept, Decline, or Send a message, for example to explain why they need to
-- decline or to suggest another time. The latest message is kept on the request; the requester sees it and is emailed.

alter table public.one_on_one_requests
  add column reply text check (reply is null or char_length(reply) between 1 and 500),
  add column replied_at timestamptz;

create or replace function public.reply_one_on_one_request(p_id uuid, p_message text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  r public.one_on_one_requests;
  m text := btrim(coalesce(p_message, ''));
  v_at timestamptz := now();
begin
  if char_length(m) < 1 or char_length(m) > 500 then raise exception 'Write a message of up to 500 characters' using errcode = '22023'; end if;
  select * into r from public.one_on_one_requests where id = p_id for update;
  if r.id is null or r.invitee_id is distinct from auth.uid() then raise exception 'not allowed' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'request already answered' using errcode = 'P0002'; end if;
  update public.one_on_one_requests set reply = m, replied_at = v_at where id = p_id;
  return v_at;
end $$;
revoke execute on function public.reply_one_on_one_request(uuid, text) from public, anon;
grant execute on function public.reply_one_on_one_request(uuid, text) to authenticated;
