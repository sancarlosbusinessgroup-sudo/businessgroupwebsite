-- Sample data. All people, businesses, emails and phone numbers are FICTIONAL.
-- Seeded accounts have no password, so nobody can sign in as them.
-- Token columns are set to '' (not NULL) because Supabase Auth cannot read NULLs there.
-- Safe to re-run: it removes only rows it created (fixed ids, example.com emails).

begin;

delete from auth.users where email like '%@example.com' and id::text like '00000000-0000-4000-8000-%';
delete from public.meetings where slug like 'scbng-meeting-%' or slug in ('fall-mixer-belmont');
delete from public.gallery_photos where image_path like '/seed/%';
delete from public.guest_requests where email like '%@example.net';

insert into public.categories (name) values
  ('Real Estate'), ('Financial Planning'), ('Senior Placement'), ('Interior Design'), ('Mortgages'),
  ('Photography & Video'), ('Business Coaching'), ('Chiropractic'), ('Notary'), ('Landscape Architecture'),
  ('Culinary Travel'), ('Insurance'), ('Reverse Mortgages'), ('Title & Escrow'), ('Hearing Care'),
  ('Estate Planning'), ('Accounting'), ('Web Design'), ('Marketing'), ('Other')
on conflict (name) do nothing;

-- Members ----------------------------------------------------------------------
with m(n, first, last, business, category, about, ideal, area, city) as (values
  (1,  'Avery',   'Lindqvist', 'Harbor Lane Realty',          'Real Estate',            'Helps families through life''s biggest moves with care, trust and expertise.', 'Homeowners planning a move in the next 12 months', 'San Mateo County', 'San Carlos'),
  (2,  'Marcus',  'Okafor',    'Northstar Wealth Partners',    'Financial Planning',     'Planning that starts with your life, not just your money.', 'Business owners approaching retirement', 'Peninsula', 'Redwood City'),
  (3,  'Priya',   'Raman',     'Golden Years Placement',       'Senior Placement',       'Guides seniors and families to the right care and living options.', 'Adult children of aging parents', 'Peninsula', 'Belmont'),
  (4,  'Elena',   'Vasquez',   'Atelier Vasquez Interiors',    'Interior Design',        'Bold, livable interiors from concept to final styling.', 'Homeowners remodeling or staging', 'Bay Area', 'San Carlos'),
  (5,  'Daniel',  'Cho',       'Bayfront Home Loans',          'Mortgages',              'Thirty years helping buyers find a clear path to homeownership.', 'First-time buyers and refinancers', 'California', 'San Mateo'),
  (6,  'Hannah',  'Brooks',    'Lumen & Frame Studio',         'Photography & Video',    'Photo and video that help businesses tell their story.', 'Professionals who need headshots or brand video', 'Bay Area', 'San Carlos'),
  (7,  'Theo',    'Marchetti', 'Clear Margin Coaching',        'Business Coaching',      'Helps owners price their work right and get ready to grow.', 'Service businesses with 1–10 employees', 'Remote + Peninsula', 'Redwood City'),
  (8,  'Grace',   'Nakamura',  'Laurel Street Chiropractic',   'Chiropractic',           'Chiropractic and sports rehabilitation in downtown San Carlos.', 'Active adults with back or joint pain', 'San Carlos', 'San Carlos'),
  (9,  'Omar',    'Haddad',    'Signal Mobile Notary',         'Notary',                 'Mobile notary and loan signing agent across the Bay Area.', 'Escrow officers and busy families', 'Bay Area', 'Foster City'),
  (10, 'Sofia',   'Lindgren',  'Fernwood Outdoor Living',      'Landscape Architecture', 'Residential landscape and hardscape design-build.', 'Homeowners planning outdoor projects', 'San Mateo & Santa Clara', 'Belmont'),
  (11, 'Isabel',  'Duarte',    'Saltwater Kitchen Journeys',   'Culinary Travel',        'Small-group food travel built around local cooks and markets.', 'Couples and friend groups who love food', 'Worldwide', 'San Carlos'),
  (12, 'Nathan',  'Pryor',     'Pryor Family Insurance',       'Insurance',              'Independent agency for home, auto, life and business coverage.', 'Families and small businesses', 'California', 'San Mateo'),
  (13, 'Celeste', 'Amari',     'Second Spring Reverse Mortgages','Reverse Mortgages',    'Reverse mortgages, explained patiently and done thoughtfully.', 'Homeowners 62+ who want flexibility', 'California', 'Burlingame'),
  (14, 'Ruth',    'Castellano','Peninsula Title Partners',     'Title & Escrow',         'Residential and commercial title and escrow.', 'Agents, lenders and buyers', 'San Mateo County', 'San Mateo'),
  (15, 'Wesley',  'Tran',      'ClearTone Hearing',            'Hearing Care',           'Hearing evaluations, fittings and tinnitus care.', 'Adults noticing hearing changes', 'Peninsula', 'San Mateo'),
  (16, 'Jordan',  'Ellery',    'Ellery Estate Law',            'Estate Planning',        'Estate planning that keeps families out of court.', 'Families with homes or businesses', 'California', 'Redwood City')
)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000',
  ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated',
  lower(first) || '.' || lower(replace(last, ' ', '')) || '@example.com',
  null, now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', first, 'last_name', last, 'business_name', business,
    'category_id', (select id from public.categories c where c.name = category)::text,
    'service_area', area, 'ideal_client', ideal, 'phone', '(650) 555-01' || lpad(n::text, 2, '0')),
  now() - make_interval(days => 400 - n * 10), now(),
  '', '', '', '', '', '', '', ''
from m;

with m(n, about, listen, services, city) as (values
  (1,  'Helps families through life''s biggest moves with care, trust and expertise.', 'We''re thinking about downsizing', array['Buying','Selling','Downsizing'], 'San Carlos'),
  (2,  'Planning that starts with your life, not just your money.', 'I sold my business', array['Retirement','Investments'], 'Redwood City'),
  (3,  'Guides seniors and families to the right care and living options.', 'Mom can''t live alone anymore', array['Assisted living','Memory care'], 'Belmont'),
  (4,  'Bold, livable interiors from concept to final styling.', 'We''re remodeling the kitchen', array['Remodels','Staging','Styling'], 'San Carlos'),
  (5,  'Thirty years helping buyers find a clear path to homeownership.', 'We were pre-approved somewhere else', array['Purchase','Refinance'], 'San Mateo'),
  (6,  'Photo and video that help businesses tell their story.', 'Our website photos are old', array['Headshots','Brand video','Events'], 'San Carlos'),
  (7,  'Helps owners price their work right and get ready to grow.', 'I''m busy but not profitable', array['Pricing','Planning'], 'Redwood City'),
  (8,  'Chiropractic and sports rehabilitation in downtown San Carlos.', 'My back is killing me', array['Adjustments','Sports rehab'], 'San Carlos'),
  (9,  'Mobile notary and loan signing agent across the Bay Area.', 'We need something notarized today', array['Loan signings','General notary'], 'Foster City'),
  (10, 'Residential landscape and hardscape design-build.', 'Our backyard is a mess', array['Design','Hardscape','Planting'], 'Belmont'),
  (11, 'Small-group food travel built around local cooks and markets.', 'We want a trip that isn''t touristy', array['Group trips','Private trips'], 'San Carlos'),
  (12, 'Independent agency for home, auto, life and business coverage.', 'My premium just went up', array['Home','Auto','Business'], 'San Mateo'),
  (13, 'Reverse mortgages, explained patiently and done thoughtfully.', 'I want to stay in my house', array['HECM','Education'], 'Burlingame'),
  (14, 'Residential and commercial title and escrow.', 'We''re about to open escrow', array['Title','Escrow'], 'San Mateo'),
  (15, 'Hearing evaluations, fittings and tinnitus care.', 'I keep asking people to repeat themselves', array['Testing','Hearing aids'], 'San Mateo'),
  (16, 'Estate planning that keeps families out of court.', 'We never made a will', array['Trusts','Wills','Probate'], 'Redwood City')
)
update public.profiles p set
  status = 'approved',
  role = case when m.n = 1 then 'admin'::public.member_role else 'member' end,
  about = m.about, listen_for = m.listen, services = m.services, city = m.city,
  approved_at = now() - make_interval(days => 380 - m.n * 10),
  member_since = (now() - make_interval(days => 380 - m.n * 10))::date,
  show_phone_public = (m.n % 4 = 0),
  website = 'https://example.com/' || p.slug
from m
where p.id = ('00000000-0000-4000-8000-' || lpad(m.n::text, 12, '0'))::uuid;

-- Fixed referral codes for the first members (used in tests/docs)
update public.profiles set referral_code = 'AVER-001' where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set referral_code = 'MARC-002' where id = '00000000-0000-4000-8000-000000000002';

-- A pending applicant
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000099',
  'authenticated', 'authenticated', 'riley.summers@example.com', null, now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', 'Riley', 'last_name', 'Summers', 'business_name', 'Summit Web Studio',
    'category_id', (select id from public.categories where name = 'Web Design')::text,
    'referral_code', 'AVER-001', 'guest_meetings_attended', '2', 'agreed_commitments', 'true'),
  now() - interval '3 days', now(),
  '', '', '', '', '', '', '', '');

-- Meetings: every other Monday 8:15–9:30 AM Pacific, plus one social event -------------
insert into public.meetings (slug, title, description, category, starts_at, ends_at, is_online, location, tags, organizer_id)
select
  'scbng-meeting-' || to_char(d, 'YYYY-MM-DD'),
  'SCBNG Meeting: ' || to_char(d, 'Mon FMDD'),
  'Join the San Carlos Business Networking Group online. Connect with local business owners, build referral relationships, and start your week with focused conversations.',
  'Networking',
  (d + time '08:15') at time zone 'America/Los_Angeles',
  (d + time '09:30') at time zone 'America/Los_Angeles',
  true, 'Online · Zoom',
  array['BusinessNetworking', 'LocalBusiness', 'SanCarlos'],
  '00000000-0000-4000-8000-000000000001'
from generate_series(date '2026-03-02', date '2027-06-28', interval '14 days') d;

insert into public.meetings (slug, title, description, category, starts_at, ends_at, is_online, location, tags, organizer_id)
values ('fall-mixer-belmont', 'Fall Mixer in Belmont',
  'Connect with professionals who serve the Peninsula over light refreshments and a Halloween-themed evening.',
  'Social', timestamptz '2026-10-28 16:00 America/Los_Angeles', timestamptz '2026-10-28 18:00 America/Los_Angeles',
  false, 'Belmont, CA', array['MemberHosted', 'SmallBusiness'], '00000000-0000-4000-8000-000000000002');

insert into public.meeting_links (meeting_id, join_url, passcode)
select id, 'https://zoom.us/j/0000000000?pwd=sample', 'sample' from public.meetings where slug like 'scbng-meeting-%';

-- Speakers for the next two meetings
insert into public.meeting_speakers (meeting_id, slot, profile_id, display_name, business)
select m.id, s.slot, s.pid, s.name, s.biz
from (select id, row_number() over (order by starts_at) rn from public.meetings
      where slug like 'scbng-meeting-%' and starts_at > now()) m
join (values
  (1, 'education'::public.speaker_slot, '00000000-0000-4000-8000-000000000012'::uuid, 'Nathan Pryor', 'Pryor Family Insurance'),
  (1, 'presentation'::public.speaker_slot, '00000000-0000-4000-8000-000000000013'::uuid, 'Celeste Amari', 'Second Spring Reverse Mortgages'),
  (2, 'presentation'::public.speaker_slot, '00000000-0000-4000-8000-000000000006'::uuid, 'Hannah Brooks', 'Lumen & Frame Studio')
) s(rn, slot, pid, name, biz) on s.rn = m.rn;

-- Attendance for past meetings (most members present most of the time)
insert into public.attendance (meeting_id, profile_id, status, checked_in_at, method)
select m.id, p.id,
  case when (abs(hashtext(m.id::text || p.id::text)) % 10) < 8 then 'present'::public.attendance_status
       when (abs(hashtext(m.id::text || p.id::text)) % 10) = 8 then 'excused' else 'absent' end,
  m.starts_at - interval '3 minutes', 'self'
from public.meetings m cross join public.profiles p
where m.slug like 'scbng-meeting-%' and m.ends_at < now() and p.status = 'approved'
  and m.starts_at >= p.approved_at;

-- Business referrals ---------------------------------------------------------------
insert into public.referrals (from_id, to_id, contact_name, warmth, notes, status, closed_amount, created_at, updated_at)
select ('00000000-0000-4000-8000-' || lpad(f::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(t::text, 12, '0'))::uuid,
       contact, warmth::public.referral_warmth, notes, status::public.referral_status, amount,
       now() - make_interval(days => ago), now() - make_interval(days => greatest(ago - 5, 0))
from (values
  (1, 4, 'Kitchen redesign client', 'hot', 'Expecting your call this week', 'contacted', null::numeric, 5),
  (4, 1, 'Seller needing staging', 'warm', null, 'closed', 6200, 12),
  (1, 12, 'Home + auto bundle quote', 'warm', null, 'sent', null, 15),
  (6, 1, 'Headshots for law firm', 'hot', null, 'closed', 9800, 26),
  (1, 7, 'Café owner wants coaching', 'warm', null, 'closed', 2400, 40),
  (5, 1, 'Refinance client intro', 'tip', null, 'not_a_fit', null, 54),
  (3, 13, 'Family exploring options', 'warm', null, 'contacted', null, 8),
  (2, 16, 'Client needs a trust', 'hot', null, 'closed', 3500, 20),
  (14, 5, 'Buyer needs pre-approval', 'hot', null, 'closed', 4100, 9),
  (8, 15, 'Patient with tinnitus', 'warm', null, 'sent', null, 3),
  (10, 4, 'Backyard + interior refresh', 'warm', null, 'contacted', null, 18),
  (12, 2, 'Retirement rollover', 'warm', null, 'sent', null, 30)
) v(f, t, contact, warmth, notes, status, amount, ago);

-- One-on-ones --------------------------------------------------------------------
insert into public.one_on_ones (reporter_id, partner_id, met_on, confirmed_at, created_at)
select ('00000000-0000-4000-8000-' || lpad(r::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(p::text, 12, '0'))::uuid,
       current_date - ago, case when confirmed then now() - make_interval(days => ago - 1) end,
       now() - make_interval(days => ago)
from (values
  (2, 1, 6, false), (3, 1, 9, true), (6, 11, 2, true), (5, 6, 4, true), (7, 4, 8, true),
  (4, 7, 9, false), (9, 1, 12, true), (10, 2, 13, true), (13, 12, 1, false), (15, 8, 3, true)
) v(r, p, ago, confirmed);

-- Guest requests (fictional guests, example.net) credited to members -----------------
insert into public.guest_requests (first_name, last_name, email, business_name, invited_by_text, referral_code, meeting_id)
select fn, ln, em, biz, 'Avery Lindqvist', 'AVER-001',
  (select id from public.meetings where starts_at > now() order by starts_at limit 1)
from (values
  ('Alex', 'Moreno', 'alex.moreno@example.net', 'Moreno Web Studio'),
  ('Dana', 'Lee', 'dana.lee@example.net', 'Lee Pilates'),
  ('Sam', 'Ortiz', 'sam.ortiz@example.net', 'Ortiz Auto')
) v(fn, ln, em, biz);
update public.guest_requests set status = 'visited' where email = 'alex.moreno@example.net';
insert into public.guest_requests (first_name, last_name, email, business_name, invited_by_text, referral_code)
values ('Riley', 'Summers', 'riley.summers@example.com', 'Summit Web Studio', 'Avery Lindqvist', 'AVER-001');
update public.guest_requests set status = 'applied' where email = 'riley.summers@example.com';

-- Gallery (images live in /public/seed/gallery) ---------------------------------------
insert into public.gallery_photos (album, caption, taken_on, image_path, thumb_path, uploaded_by)
values
  ('meetings', 'Hybrid meeting, in-person table', '2026-09-28', '/seed/gallery/1.webp', '/seed/gallery/1.webp', '00000000-0000-4000-8000-000000000006'),
  ('meetings', 'Win of the Week roundtable', '2026-09-14', '/seed/gallery/2.webp', '/seed/gallery/2.webp', '00000000-0000-4000-8000-000000000006'),
  ('mixers', 'Fall mixer group photo', '2025-10-29', '/seed/gallery/3.webp', '/seed/gallery/3.webp', '00000000-0000-4000-8000-000000000006'),
  ('mixers', 'Holiday party', '2025-12-15', '/seed/gallery/4.webp', '/seed/gallery/4.webp', '00000000-0000-4000-8000-000000000001'),
  ('spotlights', 'Member spotlight presentation', '2026-08-17', '/seed/gallery/5.webp', '/seed/gallery/5.webp', '00000000-0000-4000-8000-000000000001'),
  ('community', 'Ribbon cutting downtown', '2026-06-12', '/seed/gallery/6.webp', '/seed/gallery/6.webp', '00000000-0000-4000-8000-000000000001');

commit;
