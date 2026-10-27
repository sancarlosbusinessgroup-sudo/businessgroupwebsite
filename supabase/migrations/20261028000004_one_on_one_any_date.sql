-- Members may report a one-on-one for any past date (owner, 2026-10-27). The 14-day limit is gone;
-- only future dates are refused.
create or replace function public.check_one_on_one_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.met_on > current_date then
    raise exception 'met_on cannot be in the future' using errcode = '22023';
  end if;
  return new;
end $$;
