-- Trigger functions are internal: nobody should call them through the API.
-- (is_admin / is_approved_member stay executable because RLS policies call them as the requesting role;
--  they only ever reveal the caller's own membership state.)
revoke execute on function public.guard_profile_columns() from public, anon, authenticated;
revoke execute on function public.guard_referral_update() from public, anon, authenticated;
revoke execute on function public.prepare_guest_request() from public, anon, authenticated;
revoke execute on function public.sync_guest_status() from public, anon, authenticated;
revoke execute on function public.stamp_approval() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.check_one_on_one_date() from public, anon, authenticated;
