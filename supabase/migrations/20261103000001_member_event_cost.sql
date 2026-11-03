-- Owner request 2026-11-03: the host says whether a member event is free or paid; a paid event shows its price
-- and where to pay (a payment link and/or written instructions such as "Pay at the door" or "Venmo @name").
-- Additive: existing events become free.
alter table public.member_events add column is_paid boolean not null default false;
alter table public.member_events add column price text
  check (price is null or char_length(trim(price)) between 1 and 80);
alter table public.member_events add column payment_url text
  check (payment_url is null or (payment_url ~* '^https://[^[:space:]]+\.[^[:space:]]+$' and char_length(payment_url) <= 500));
alter table public.member_events add column payment_info text
  check (payment_info is null or char_length(trim(payment_info)) between 2 and 300);

-- Paid: needs a price and at least one way to pay. Free: no price or payment details.
alter table public.member_events add constraint member_events_cost_check check (
  (is_paid and price is not null and (payment_url is not null or payment_info is not null))
  or (not is_paid and price is null and payment_url is null and payment_info is null)
);
