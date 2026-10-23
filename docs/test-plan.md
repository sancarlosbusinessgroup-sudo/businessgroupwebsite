# Test plan

Requirement numbers refer to the build brief: **R1** pages reproduced · **R2** interactions work · **R3** Supabase schema, RLS, seed · **R4** auth + approval · **R5** forms (validation, errors, states) · **R6** empty/loading/error states · **R7** repo + README · **R8** deploy. **A11y** = WCAG 2.1 AA (axe). **PA** / **PB** = Phase A / B of `docs/phase-2-spec.md`.

Status as of the last full run (2026-10-17, freshly reset local stack, `npm run test:all` order): **Unit 62/62 · Database 61/61 · E2E 103/103 (69 desktop + 17 tablet 768px + 17 phone 375px)**. Lint, type-check, Prettier and `next build`: clean.

## Unit (Vitest + React Testing Library): `npm test`

| Test                                                                                                            | Covers        | Status  |
| --------------------------------------------------------------------------------------------------------------- | ------------- | ------- |
| dates › countdownParts splits time / never negative                                                             | R2 countdown  | passing |
| dates › formats in Pacific time regardless of viewer timezone                                                   | R1            | passing |
| dates › inCheckInWindow opens 15 min before start, closes at end                                                | R2 attendance | passing |
| dates › monthGrid pads first week, covers all days                                                              | R2 calendar   | passing |
| validation › guest request valid / bad email + honeypot                                                         | R5            | passing |
| validation › join accepts complete application / requires commitments / rejects short password + unsafe website | R4 R5         | passing |
| validation › 6-digit code; new password must match                                                              | R4 R5         | passing |
| validation › referral needs member + prospect name                                                              | R5            | passing |
| validation › referral slip: prospect phone/email checked, consent checkbox, no temperature field                | PA R5         | passing |
| validation › referral status update: new / contacted / meeting set / closed deal / not a fit, no amount         | PA R5         | passing |
| validation › weekly ask optional, ≤160 chars                                                                    | PA R5         | passing |
| validation › leadership needs name + role; seat limit 1–99                                                      | PA R5         | passing |
| periods › week / meeting cycle / month / quarter / year / all / custom in Pacific dates, fallbacks              | PA            | passing |
| exports › CSV (BOM, CRLF, quoting, formula-safe) and vCard 3.0 escaping                                         | PA            | passing |
| stats › sortStatRows by count or name, stable and non-mutating                                                  | PA            | passing |
| validation › one-on-one date within last 14 days                                                                | R5            | passing |
| validation › profile splits services, checkboxes → booleans                                                     | R5            | passing |
| directory › keyword matches business/name/category/about; category + sort                                       | R2            | passing |
| directory › paginate clamps pages                                                                               | R2            | passing |
| stats › attendance %, bar heights, duplicate one-on-one flags                                                   | R1            | passing |
| attendance › missing records = absent, streak; excused keeps streak                                             | R1            | passing |
| ics › calendar file escaping + UTC times                                                                        | R2            | passing |
| images › accepts photos ≤25 MB, rejects other types/oversize                                                    | R5            | passing |
| Countdown › ticks every second (role=timer) / "starting now"                                                    | R2 A11y       | passing |

## Database security (Vitest + Postgres): `npm run test:db`

| Test                                                                                                  | Covers | Status                                        |
| ----------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------- |
| RLS enabled on every public table                                                                     | R3     | passing                                       |
| anon: sees only approved listed members                                                               | R3     | passing                                       |
| anon: cannot read contacts, Zoom links, attendance, referrals, one-on-ones, feedback, guest requests  | R3 R4  | passing                                       |
| anon: can read meetings, speakers, gallery, categories                                                | R3     | passing                                       |
| anon: guest request credits referrer                                                                  | R3     | passing                                       |
| anon: cannot forge guest status/referrer                                                              | R3     | passing                                       |
| anon: cannot call member-only functions (admin_member_stats, leaderboard, group_totals, join_meeting) | R3 PA  | passing                                       |
| anon: cannot write members/meetings                                                                   | R3     | passing                                       |
| pending: can read/edit own profile                                                                    | R4     | passing                                       |
| pending: cannot self-approve or become admin                                                          | R4     | passing                                       |
| pending: no contacts, Zoom links, one-on-ones                                                         | R4     | passing                                       |
| pending: cannot join meetings or send referrals                                                       | R4     | passing                                       |
| member: sees contacts + Zoom links                                                                    | R3 R4  | passing                                       |
| member: only own referrals                                                                            | R3     | passing                                       |
| member: can refer as self, not as others                                                              | R3     | passing                                       |
| member: only receiver can mark a referral a closed deal                                               | R3 PA  | passing                                       |
| member: cannot read others' private one-on-one notes                                                  | R3     | passing                                       |
| member: one-on-one older than 14 days rejected                                                        | R3 R5  | passing                                       |
| member: sees only own attendance                                                                      | R3     | passing                                       |
| join_meeting: returns link, records attendance only in window                                         | R2 R3  | passing                                       |
| member: cannot write attendance directly                                                              | R3     | passing                                       |
| per-member stats: admins only, refused even for own row                                               | R3 PA  | passing                                       |
| admin: approve stamps member_since                                                                    | R4     | passing                                       |
| admin: reads guest requests + pending profiles                                                        | R4     | passing                                       |
| storage: upload only into own folder; pending cannot upload                                           | R3     | passing                                       |
| sign-up trigger: pending profile + contact from metadata                                              | R4     | passing                                       |
| sign-up trigger: ignores self-assigned status/role                                                    | R4     | passing                                       |
| seed: regular meetings are Mondays 8:15–9:30 AM Pacific in any session time zone                      | R3     | passing (added after a deploy bug, see below) |

### Phase A database tests (`tests/db/phase-a.test.ts`)

| Test                                                                                                                 | Status  |
| -------------------------------------------------------------------------------------------------------------------- | ------- |
| ratings, closed amounts, show_stats and the old stats functions are gone; confirm_one_on_one takes only the id       | passing |
| referral statuses new → contacted → meeting set → closed deal / not a fit; temperatures hot / warm / cold            | passing |
| partner confirms a one-on-one without a rating                                                                       | passing |
| giver files a slip with prospect phone/email/consent; starts as new; cannot be filed already closed                  | passing |
| closed deal stamps closed_at, reopening clears it, closed_at cannot be set by hand                                   | passing |
| giver can edit notes but not the receiving member                                                                    | passing |
| admin stats: one-on-ones (confirmed, both members), referrals + closed deals (giver), received deals, visitors       | passing |
| admin stats respect the date range and list approved members only                                                    | passing |
| leaderboard: names + counts only, top 5 per metric, sorted, no zeros                                                 | passing |
| pending applicants cannot see leaderboard or group totals; group totals count each confirmed one-on-one once         | passing |
| leadership: public read, members cannot write, admins can add/edit/remove                                            | passing |
| directory downloads: members log their own, only admins read all, pending/visitors cannot log, format checked        | passing |
| weekly ask: own only, ≤160 chars, update time stamped                                                                | passing |
| open categories: default 1 seat, public list; full category blocks approval and moves but not pending; raising opens | passing |
| members cannot change seat limits                                                                                    | passing |

## End-to-end (Playwright + axe): `npm run test:e2e`

Tests tagged **@responsive** also run at 768px and 375px.

| Test                                                                                                                                        | Covers     | Status               |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------- |
| 12 public pages render, no console errors, axe clean @responsive                                                                            | R1 R6 A11y | passing ×3 viewports |
| dark mode: home, members, visit, login pass axe                                                                                             | A11y       | passing              |
| unknown page → 404                                                                                                                          | R6         | passing              |
| header links reach every page, aria-current                                                                                                 | R2         | passing              |
| mobile menu opens/closes, no horizontal scroll @responsive                                                                                  | R2         | passing ×3           |
| member pages redirect signed-out visitors                                                                                                   | R4         | passing              |
| home countdown ticks; member count from DB                                                                                                  | R2 R3      | passing              |
| directory search / no-match empty state / category / clear                                                                                  | R2 R3 R6   | passing              |
| public profile hides contact details from visitors                                                                                          | R3 R4      | passing              |
| events: list/calendar toggle, month nav, category filter, detail, .ics                                                                      | R2 R3      | passing              |
| gallery: album filter, lightbox with arrows + Escape                                                                                        | R2 A11y    | passing              |
| guest form: inline errors + focus on first error                                                                                            | R5         | passing              |
| guest form: saves, credits ?ref= referrer (verified in DB)                                                                                  | R3 R5      | passing              |
| join: per-step validation → pending account (trigger data verified) → email confirm link → pending gate → admin approves → member dashboard | R3 R4 R5   | passing              |
| join: duplicate email error                                                                                                                 | R4 R5      | passing              |
| login: wrong password error, success, log out                                                                                               | R4 R5      | passing              |
| login: empty form errors                                                                                                                    | R5         | passing              |
| login: email code (wrong code error, then real code from email)                                                                             | R4 R5      | passing              |
| password reset: email link → mismatch error → new password works                                                                            | R4 R5      | passing              |
| expired/invalid email link → login message                                                                                                  | R4 R6      | passing              |
| 8 member pages render, no console errors, axe clean @responsive                                                                             | R1 R6 A11y | passing ×3           |
| members see contact details + member nav                                                                                                    | R4         | passing              |
| RSVP dropdown (Can attend / Can't attend / no answer) saved                                                                                 | R2 R3      | passing              |
| claim (with topic)/release speaker slot                                                                                                     | R2 R3      | passing              |
| Zoom link opens stored URL                                                                                                                  | R2 R3      | passing              |
| attendance correction: validation + saved                                                                                                   | R5         | passing              |
| one-on-one: errors → report → partner confirms (no stars)                                                                                   | R3 R5      | passing              |
| referral slip: errors → send with prospect phone + consent → receiver marks closed deal (closed_at verified in DB)                          | R3 R5 PA   | passing              |
| invite link copy (now on the dashboard "Invite a visitor" card)                                                                             | R2 PA      | passing              |
| profile edit: website error → save → public profile shows it                                                                                | R3 R5      | passing              |
| non-admin sent away from /admin                                                                                                             | R4         | passing              |
| admin marks guest visited                                                                                                                   | R3 R4      | passing              |

### Phase A end-to-end tests (`tests/e2e/phase-a.spec.ts`)

| Test                                                                                                        | Status               |
| ----------------------------------------------------------------------------------------------------------- | -------------------- |
| footer has no "Proud supporter" / San Carlos Life credit                                                    | passing              |
| footer has no "Artwork and images contributed by…" credit line (added 2026-10-21, owner asked to remove it) | passing              |
| About shows the Management list from the database                                                           | passing              |
| visitors: directory shows businesses only; no contacts, no downloads; export URL → login                    | passing              |
| public profiles show no per-member activity stats                                                           | passing              |
| Visit lists open professions; Join marks full categories and warns                                          | passing              |
| dashboard: leaderboard (4 metrics, period switch), group totals, invite card; no personal tiles/$           | passing              |
| weekly ask: save on dashboard → shown in directory                                                          | passing              |
| directory cards show contacts; CSV + vCard downloads with expected content; both logged                     | passing              |
| one-on-one form has no star rating                                                                          | passing              |
| members cannot open admin stats or its CSV export                                                           | passing              |
| admin pages render, no console errors, axe clean @responsive                                                | passing ×3 viewports |
| admin stats: period, custom range, sort (aria-sort), CSV export                                             | passing              |
| Management: validation → add → shown on About → edit → remove                                               | passing              |
| category seats: raise limit → profession opens on Visit → reset                                             | passing              |
| admin sees the directory download log                                                                       | passing              |

### Not covered by automated tests (and why)

- **Photo upload to Storage** (gallery, profile photo/logo): the local test stack has no Storage server. Covered by the storage RLS tests, the file-check unit test, and a manual check after deploy.
- **Loading skeleton** (`app/loading.tsx`): appears only on slow networks; verified manually.
- **Production smoke test**: to run against the live URL after deploy (`E2E_BASE_URL=…`).

## Phase B tests

### Unit

| Test                                                                                                                                          | Status  |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| dates › Pacific date+time → UTC across daylight saving, malformed input, round trip                                                           | passing |
| slides › default agenda order, saved order cleaned (unknown/duplicate keys), fallback to defaults; chunk                                      | passing |
| validation › member event: Pacific → UTC, online needs https link, in person needs address, end after start, not in the past, category, title | passing |
| validation › speaker topic required 3–120 chars, description optional                                                                         | passing |
| validation › slide settings form → shown slides in chosen order, at least one                                                                 | passing |

### Database (`tests/db/phase-b.test.ts`)

| Test                                                                                                                 | Status  |
| -------------------------------------------------------------------------------------------------------------------- | ------- |
| member events: public read, visitors cannot post                                                                     | passing |
| approved member posts as self; slug generated and unique                                                             | passing |
| nobody posts as someone else; pending cannot post                                                                    | passing |
| online needs https link; in person needs address                                                                     | passing |
| event image must be in the host's own upload folder                                                                  | passing |
| host edits/deletes own; other members cannot; host cannot hand the event to someone else; admins can edit/remove any | passing |
| at most 10 events per member in 30 days                                                                              | passing |
| speaker claims a slot with topic + description; topic length limit                                                   | passing |
| slide settings: members read, only admins write, slide names checked; visitors cannot read                           | passing |
| meeting_visitors: members get first name + last initial; visitors and pending refused                                | passing |

### End-to-end (`tests/e2e/phase-b.spec.ts`)

| Test                                                                                                                                               | Status               |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| visitors see member events, must log in to post                                                                                                    | passing              |
| member posts (validation, axe) → public page "hosted by" → edit → shown on /events and in both .ics feeds → other member can't edit → host deletes | passing              |
| online event: insecure link rejected, "Join online" link, "Member events" filter                                                                   | passing              |
| admins can edit/remove any member event                                                                                                            | passing              |
| slides: signed-out visitors redirected                                                                                                             | passing              |
| slides: keyboard (← → PageDown Home End), Prev button, 5-minute speaker + topic, axe @responsive                                                   | passing ×3 viewports |
| slides: admin hides and reorders slides for a meeting, then resets (axe on setup page)                                                             | passing              |
| members cannot customize slides                                                                                                                    | passing              |

## Application form and Bylaws & Procedures (2026-10-17)

| Test                                                                                                                                                    | Kind | Status     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------- |
| validation › join requires the agreement + typed signature; business questions; two references each with email or phone; packs answers for the database | unit | passing    |
| sign-up trigger stores the application answers (references, signature, agreed time) and copies the product/service into the profile                     | DB   | passing    |
| no application row without application metadata                                                                                                         | DB   | passing    |
| applications readable only by the applicant and admins; no direct inserts/updates                                                                       | DB   | passing    |
| one-page application: all errors at once + focus, full submit, answers stored, admin "View application", approve                                        | E2E  | passing    |
| same email cannot apply twice (one-page form)                                                                                                           | E2E  | passing    |
| Bylaws & Procedures page: sections, agenda, absence rule, leadership from the Management list, axe @responsive                                          | E2E  | passing ×3 |
| Bylaws linked from the footer and the application form; Visit page shows the official agenda                                                            | E2E  | passing    |

## Change log (tests corrected while being written, before they ever passed)

All changes fixed test mistakes, not app behaviour. None weakened an assertion.

1. `rls › cannot forge a guest request status`: originally expected an RLS error, but the database silently resets `status`/`referrer` before the RLS check. Now asserts the stored row is `requested` with no referrer. Same security guarantee, now asserted directly.
2. E2E password field locators: the label includes a visual "*" and the tab panel is also named "Password", so lookups now use a prefix match inside the Password tab panel.
3. Home count locator: scoped to the "At a glance" list (the number also appeared in the countdown).
4. Events test: waits for the List view URL before clicking a filter (race).

### Added after deploy

5. New test `seed data › schedules every regular meeting on a Monday, 8:15–9:30 AM Pacific`. The live site showed meetings on Sunday evenings: the seed built times from `generate_series(date…)`, which returns timestamps, so the Pacific conversion depended on the database session time zone. The test failed against the old seed, passes against the fixed one; the cloud rows were corrected in place.

6. Group renamed to the placeholder `[New Name]` at the owner's request (2026-10-15). Four E2E heading expectations in `public.spec.ts` now expect the new headings, the seed-data test filters on the renamed meeting slugs (`group-meeting-…`), and the calendar unit test's input label changed. These follow the changed requirement; no assertion was loosened.

### Phase A (2026-10-16), approved by the owner before the change

7. Approved Phase 1 proposal: `rls › admins › can read guest requests and pending profiles` now asserts the seeded pending applicant is in the result instead of an exact count of 1, so it no longer depends on running before the E2E tests.
8. Requirement changes from the phase 2 spec (owner approved each in chat):
   - Deleted `StarRating.test.tsx` with the star-rating component (spec #2, ratings removed).
   - `rls › only the receiver can mark a referral closed` uses status `closed_deal` with no amount (spec #3).
   - `rls › member_stats works for self…` became "per-member stats are admins only, refused even for your own row" (decision 3).
   - `rls › anon cannot call member-only functions` points at the new functions (`admin_member_stats`, `leaderboard`, `group_totals`).
   - Validation "closing a referral requires an amount" became "referral status update takes the new statuses and no amount"; the profile test no longer checks the removed `showStats` field.
   - E2E referral test: files a referral slip and the receiver marks it a closed deal (no amount step). E2E one-on-one test no longer clicks a star.
   - E2E "invite link is shown and copyable" opens `/dashboard` instead of `/referrals`, because the spec moves the invite card to the dashboard. Same assertions.
9. New Phase A tests corrected while being written, before they ever passed: the enum test cast labels to `text` (Postgres returned a `name[]` as one string); two stats tests used prospect names shorter than the 2-character minimum; three E2E locators were ambiguous ("President" also matched "Vice President"; "Period" also matched the form's label; "Name" needed a non-exact match because of the required-field asterisk).
10. Owner removed the temperature choice (2026-10-17): the referral-slip validation test now checks there is no temperature field, and the E2E referral test checks the Temperature field is absent instead of choosing "hot".
11. Real issue found by axe at 375px: the directory-download table's scroll area wasn't keyboard-focusable. Fixed in the page (focusable labelled region); the test was not changed.

### Phase B (2026-10-17)

12. Requirement change from the spec (speaker topics): `member › claim and release a speaker slot` became "claim a speaker slot with a topic, then release it". It now fills in the required topic (and checks the "Add a topic" error first). Same release assertions.
13. New Phase B tests corrected while being written, before they ever passed: two link locators needed `exact: true` (the event title also appears in "Add to calendar for …" link names); "Online" radio needed `exact: true` (also matched "Online link"); the event test now waits for "Log out" to finish before navigating (it was racing the sign-out and still signed in).

### Application form (2026-10-17, owner request to rebuild Join as their paper application)

14. Requirement change: the multi-step Join form became one page matching the paper Member Application Form. `auth › join form validates each step…` became "one-page application validates, creates a pending account with the application…" (same assertions for the pending account, email confirmation, gate and approval, plus the new answers); `auth › the same email cannot sign up twice` fills the one-page form; validation tests use the new fields ("requires all three commitments" became "requires agreeing to the terms and a typed signature"). The Phase A test "join form warns about a full category" no longer clicks Continue (there are no steps).
15. Real issues found by the tests and fixed in the app (tests unchanged): the directory search form kept the old keyword after "Clear" (form now resets on navigation); the Bylaws agenda table's scroll area wasn't keyboard-focusable at 375px.

### Name, logo and separate meetings/events pages (2026-10-17, owner request)

16. Requirement change: the group is now **Bay Area Referral Partners**. Heading expectations in `public.spec.ts` and the welcome-slide heading in `phase-b.spec.ts` expect the real name instead of `[New Name]`.
17. Requirement change: group meetings and member events are on separate public pages (`/group-meetings` and `/events`). The public-pages list checks both headings; the header-navigation test also visits Meetings; the home test expects the "Group meetings" and "Member events" sections instead of one "Events & meetings" list; the list/calendar/filter/detail test now runs on `/group-meetings` (the Fall Mixer is a group event) and also checks the "← All meetings" link. In `phase-b.spec.ts` the "Member events" filter chip no longer exists (the whole page is member events), so the online-event test filters by its Workshop category instead, and still checks that no group meeting appears.
18. New tests: `home: header logo and the full-width hero photo behind the text and countdown`; `group meetings and member events are on separate pages`.

### Owner change requests (2026-10-17, second batch)

19. Requirement change (dollar values are back): `validation › referral slip…` now checks the optional dollar value and that there is no consent field (the owner removed "The prospect has agreed to be contacted"); `referral status update…` accepts an optional value; `phase-a › group totals count each confirmed one-on-one once` expects the new `closed_amount` key; the E2E dashboard test expects a "Business closed" dollar tile instead of "no $ anywhere"; the admin stats CSV header has two new columns (Business given / received); the E2E referral test fills the value (invalid first), the receiver updates it, and the database row is checked for the amount instead of consent.
20. Requirement change (directory cards): the person's name is now the card link and heading, the business is the smaller line. The directory search test looks for the person link ("Wesley Tran", "Avery Lindqvist") and still checks the business text. New test checks the name is larger than the business.
21. Requirement change (slides): the 5-minute slide heading is now "5-Minute Member Education"; the keyboard test steps through up to 16 slides (three new agenda slides), and slide 2 is now "Open Networking" (was "Please silence your phones"). `slides › defaults follow…` lists the new standard order.
22. New tests: `db/owner-changes.test.ts` (referral value and dollar totals, admin-only per-member dollars, cancelled meetings block slot claims, one-on-one request rules, new slide names and extra text); `e2e/owner-changes.spec.ts` (hero and header buttons, Report Activity submenu incl. keyboard Escape, request → accept a one-on-one, admin cancels/restores a meeting, presentation descriptions, white slides with #008080 text, agenda slides and extra slide text); unit tests for the one-on-one request and slide-text schemas.
23. Real issue found by axe: the large step numbers on Home in the secondary colour #12a89d were below AA contrast on white; they now use #0c7b74. The test was not changed.

### Banners, directory photos, profile, Support page (2026-10-17, third request)

24. Requirement change: the meetings page title and Home section are now "Meeting Schedules" (public-pages list and Home test updated). New tests: Home wording, light-wash title banners with the bridge photo (dark title text kept), large photo area on directory cards, profile banner (white name, no one-on-one/referral buttons), and the Support page (team, FAQ, chat button opening the coming-soon window). `/support` added to the public-pages axe list.
25. Fourth request (2026-10-17): header-navigation test also visits Support (new menu item). New tests: Home countdown card is a light see-through panel with dark text in light and dark mode; Support in the members' menu; Visit invite text describes the group.
26. New test corrected while being written, before it ever passed: the browser reports the card's white gradient in oklab notation, so the colour check accepts rgba or oklab white at partial opacity.
27. Note: `public › members directory search, category filter and clear` failed once in a partial run (passes in full runs and 3/3 on repeat). Logged to investigate; not changed.

### Phase C: email through Brevo (2026-10-20)

28. New tests: `src/lib/email/templates.test.ts` (escaping of member text, every email has HTML and plain text, onboarding and Zoom links, preference footer); `db/phase-c-email.test.ts` (email preferences are private to the member, the email log is server-written and admin-read with one row per notice, onboarding needs an approved member and both agreements, visitors have no access); `e2e/phase-c-email.spec.ts` against the local Brevo stand-in (approval → welcome email + newsletter list + onboarding page; referral and status-change emails, sent once per status; switching off an optional email; one-on-one request/answer/confirm emails; guest thank-you plus notices to the inviting member and admins; the daily job refuses callers without the secret, sends the meeting-day reminder with the Zoom link, the Monday digest and the visitor follow-up, and never twice).
29. Real issue found by the new referral test and fixed in the app: after saving a referral update, the Status box jumped back to the old status (React resets forms after saving and a `<select>` keeps its first default), so pressing Save again undid the change. The box now keeps the saved status. The test asserts this.
30. Note: `public › members directory search, category filter and clear` failed again once in the full run (136 of 137 passed) and passed 3/3 on repeat. Still not changed; see 27.

### New agenda slides, added slides, application form (2026-10-21, owner request)

31. Requirement change (agenda, Procedures effective October 19, 2026): slide names and order follow the new agenda (welcome, agenda, networking, call to order, leadership, guests, 60-second infomercials, asks, statistics, leaderboards, 5-minute + questions, 10-minute + questions, announcements, thank you visitors, adjourn). Updated: `slides › defaults follow…` (new list and agenda times) plus a new test that settings saved with the old names still work; `validation › slide settings / extra slide text` use the new names (`adjourn`, `call_to_order`, `announcements`); `phase-b › members open the next meeting deck` (slide 2 is now "Today's agenda", the slide before the last is "Thank you for visiting", the 5-minute slide heading is "Member education"); `phase-b › admins turn slides off and reorder` uses the new labels (now shown with their times, e.g. "8:30 · Meeting called to order"); `owner-changes › slides…` expects the new slide names and the "60-second infomercials" slide text; `governance › the Visit page shows the official meeting agenda` expects "60-second infomercials" instead of "30-second infomercial".
32. Requirement change (database check): `db/phase-b › slide names are checked` now uses an invalid _shape_ (`Bad-Name!`) instead of an unknown name (`bogus`). The database now checks only the shape of slide names; the list of valid names lives in the app (so old names keep working and new slides need no constraint change), and unknown names are dropped by `resolveSlides` (unit-tested). This is the one constraint the owner was asked to approve.
33. Requirement change (application form matches the paper form): sections are "Business information", "Business reference 1/2", "Agreement terms"; references have a Business name; the agreement uses the paper wording ("By signing below…"); Name is shown next to Signature and Date. `auth.spec.ts` uses the new section name and exact/regex labels for reference Name and Business (the new "Business name" field would otherwise match too); `validation › joinSchema packs the application answers` expects `business_name: null` on each reference.
34. Updated `governance.spec.ts`: Bylaws effective October 19, 2026; new checks for the 9:10 questions row, the "15-Minute Presentation" heading, the infomercial example and the 60-second tardiness rule.
35. New tests: `src/lib/leadership.test.ts` (Leadership / Membership Committee / Attendance Managers grouping); `slides.test.ts › parseYouTube`; `db/slides-media.test.ts` (new slide names accepted, added-slide permissions and per-kind rules, private bucket limits, reference business name stored); `e2e/slides-application.spec.ts` (agenda order, logo and bridge photo on every slide, the 60-second timer, admins add an image / 2-page PDF / YouTube video then move and remove them, Invite to apply email → prefilled form, paper-form fields saved). The local stack's gateway now emulates file storage for these tests.

### Slide changes (2026-10-21, owner's second request)

36. Requirement change (standard deck = owner's order): no section tabs above titles; slide 1 is just the large logo; "Open Networking" → "Welcome" without the intro line; "Let's begin." without the purpose quote; "Meet the Management Team" with every person shown the same way (photo, then name and role below); "Introduction of Guests" title only; infomercial slide without its visible title, the share items as bullets; the 5- and 10-minute slides show the presentation title instead of the slot description, each followed by its questions slide (1-minute / 5-minute timer). "Today's agenda", "This week we're looking for…" and "Thank you, visitors" left the standard deck but can still be ticked per meeting. Updated: `slides › defaults…` (new list, and the three optional slides stay available); `phase-b › members open the next meeting deck` (slide 2 heading "Welcome", the slide before the last is "Upcoming events", 5-minute heading "5-Minute Educational Presentation"); `phase-b › admins turn slides off…` (new label "Let's begin (meeting called to order)"); `owner-changes › slides…` (new labels; finds the infomercial slide by its text; checks the #008080 title colour on slide 2 because slide 1 no longer has visible text); `slides-application` deck test rewritten for the new deck and a new test for the per-presentation materials (PDF for the 5-minute, YouTube for the 10-minute, shown right after the presentation and before its questions).
37. Requirement change (2026-10-21, third request): slide titles and text are centred vertically; "Introduction of Guests" is centred on the slide; the "60-second infomercials" title is back. `slides-application` deck test now checks the title is visible, that the Welcome title is not at the top, and that the guests title is centred.
38. Requirement change (2026-10-21): the Welcome slide shows the Golden Gate photo on the right, fading to white beneath the text. The deck test checks the photo is visible on that slide.
39. Requirement change (2026-10-21): the logo slide shows the Golden Gate photo at full strength (no white wash), with a soft white glow radiating from the logo letters (no box). Existing logo-only and logo-size checks still apply; no test changes.

### Footer credit and RSVP dropdown (2026-10-21, owner request)

40. New test: the footer no longer shows "Artwork and images contributed by Vabrato Real Estate & Upendo Ventures" (`phase-a.spec.ts`).
41. Requirement change: RSVP on the Meetings page is a dropdown with "Can attend" and "Can't attend" instead of an RSVP / ✓ Going button. `member › RSVP toggles and is saved` replaced by `member › RSVP dropdown…` (picks Can attend, checks it is saved and shown after reload, switches to Can't attend, then clears it). New `db/rsvp.test.ts` for migration `20261021000002_rsvp_attending.sql` (answers default to attending, members change only their own answer).

### Meeting recap email (2026-10-21, owner request)

42. New tests: `templates.test.ts` (recap has the slides link, presenters with topic, business and video, member events, next meeting with open slots and the claim button, preferences footer; also reads well with no presenters or events; added to the every-template check); `e2e/phase-c-email.spec.ts › after-meeting job` (refuses callers without the secret, sends nothing before the meeting ends, sends the recap after it ends with slides link and presenter, skips a member who switched it off, and the next morning's daily job does not send it again).

### Presentation timer on added slides, website links (2026-10-21, evening)

43. Requirement change (2026-10-21, evening): presenters' added slides (after the 5- or 10-minute presentation) show that presentation's timer on top, sharing one countdown with the presentation slide; admins can add any https website link as well as YouTube (one "YouTube or website link" field, button "Add link"). Updated `slides-application` (form and label names; the invalid example is now "not a link" because a non-YouTube https link is now valid) and rewrote the materials test to cover the PDF, a website and a YouTube video, the shared running/paused timer, and "Show the website here" / "Open in a new window". New: `slides.test.ts › parseWebsite`; `db/slides-media.test.ts › website links on slides` (new table `meeting_slide_links`, migration 20261021000003, applied live).
44. Flaky test fixed (items 27/30): `public › members directory search, category filter and clear` chose the category before the "Clear" page load had finished; the search form is rebuilt on that load, which undid the choice. The test now waits for Clear to finish (URL, no "No members match", empty keyword) before choosing. Same assertions; 15/15 passes on repeat.

### Live chat with tawk.to (2026-10-21, owner request)

45. New tests: `src/lib/chat.test.ts` (chat is off unless both tawk.to IDs are set and well-formed, spaces trimmed, embed address, bubble hidden on the meeting slides only, member name/email passed to the chat); `src/components/site/LiveChat.test.tsx` (widget script loaded once with the configured IDs, member details filled in, not loaded on the slides, hidden when moving to the slides and shown again after); `src/app/support/SupportChatButton.test.tsx` (coming-soon window while chat is off, opens the chat window when it is on, waits for a slow load, explains what to do when the chat is blocked). The existing E2E test `owner-changes › support page … coming-soon window` is unchanged and still applies, because the local test stack has no tawk.to IDs (chat off). No E2E test loads the real tawk.to widget, since that would depend on an outside service.

### Timer switches (2026-10-22, owner request)

45. New tests: `slides.test.ts › resolveTimers` (every timer on unless saved off); `db/slides-media.test.ts › timer switches` (new column `meeting_slide_settings.timers`, migration 20261022000001, additive, applied live: admins only, JSON object only); `slides-application › admins switch timers off per slide and on the presenter's added slides` (turning off the 5-minute questions timer and the timer on the 5-minute presenter's slides hides them, the other timers stay; reset restores them).
46. Note: `phase-b › a member posts an event…` failed once in a full run and passed 3/3 alone, then the whole suite passed (146/146) on a second full run. Not changed; watching it.

### Slide changes (2026-10-22, owner request)

47. Requirement changes: larger logo top left; no date/time card on slides; "Let's begin." is the title only, centred, with a "silence your phone" icon; new "Visitors" slide after it (attend for free; 5-step path to membership); timers are off by default and switched on per meeting; "Our numbers" → "Statistics"; infomercial slide titled "60-second infomercial and reporting" with "Infomercial" first and no "Announcements". Updated: `slides.test.ts` (standard order includes `visitor_path`; timers off unless saved on; new infomercial label); `owner-changes › slides…` (new infomercial label); `slides-application` deck test (new order, Let's begin centred with the icon and no list, Visitors path, no AM time stamps and no timers by default, new bullets/title, Statistics title; the timer interaction moved to the timer test); the materials test switches the presentation timers on first; the timer test now checks all timers start off, switches three on and checks only those show; the image test's next slide after "Let's begin" is now "Visitors".
48. Note: `auth › one-page application…` failed once as the first test of a full run (cold server) and passed on fresh data; not changed.
49. Requirement change (2026-10-22): the Management Team slide is grouped like the printed slide (first two leaders and the Attendance Managers, other roles, Membership Committee; photo, role, name, business). The deck test now also checks the Membership Committee heading on that slide.
50. Requirement change (2026-10-22): new slide design from the owner's sample decks and flow diagrams (gradient band, cards, icon badges, numbered Visitors flow); "Introduction of Guests" taken out of the standard deck (still available per meeting); new silence-your-phone icon; Welcome bullets each in a box, second one starts "Please"; no sentence under the infomercial title; Shermaine's surname is Benolirao. Updated: `slides.test.ts` (standard order without `guests`; `guests` listed as available-but-not-default); `slides-application` deck test (order without guests, checks the guests slide is absent, the "Please…" bullet, and no sentence under the infomercial title); `owner-changes › slides…` finds the infomercial slide by its title instead of the removed sentence; `owner-changes › support page` expects "Shermaine Benolirao"; `owner-changes › slides: white background…` expects the new navy title colour (rgb 18,52,110) instead of teal. No assertions weakened.
51. Phase D, Zoom attendance (2026-10-23). New tests: `zoom.test.ts` (meeting ID from join links, name normalising, merging rejoins, matching by email / unique full name / remembered alias / invited guest and never guessing between two people with the same name, late after 8:30 and left before 9:30, absences counted only for meetings with attendance taken in the last 6 months, substitutes count as attended and excused as missed); `db/zoom-attendance.test.ts` (migration 20261023000001, additive: admins write imports, participants and aliases; members only see which meetings were taken and their own Zoom minutes; visitors see nothing; value checks); `zoom-attendance.spec.ts` (against a local Zoom mock, `scripts/local-stack/zoom-mock.mjs`: fetch from Zoom, guest marked Visited, review list linking with a remembered name, attendance by hand with substitute and excused, fetching again keeps decisions, member view with Zoom times / flags / missed count, after-meeting job imports, "no session" error shown to admins).
52. Requirement changes (2026-10-23): Support page members only (`owner-changes › support page` now checks the login redirect and that the footer no longer links to it, then opens it as a member; `/support` removed from the public-banner test list since visitors can't open it); directory "Download spreadsheet (CSV)" became a "BARP Google Sheet" link in a new tab (`phase-a › directory…` checks the link and still checks the CSV export through its URL, so the download count is unchanged); password fields gained a "Show password" button, so `getByLabel('Password')` became `getByLabel('Password', { exact: true })` in `auth.spec.ts` and `slides-application.spec.ts` (selector only). New `owner-2026-10-23.spec.ts`: one-on-one history table, no referral intro paragraph, show/hide password, change password from My profile (wrong current password and mismatch refused).
53. Slide changes (2026-10-23): standard deck adds "BARP Champion" (coming soon) after the leaderboards and no longer includes the two question slides (still optional); Welcome has two reworded points; Visitors step 2 "Receive all application forms"; events show the month large; closing slide shows the next presenters with photos; Refresh button / R key. Updated: `slides.test.ts` (new standard order; question slides listed as optional); `slides-application` deck test (new order, new Welcome text, "all application forms", BARP Champion, no question slides after the presentations, next presenters list); the materials and timer tests switch the question slides on first (helper `showQuestionSlides`) so their timers are still tested.
54. Note (2026-10-23): in one full run `auth › one-page application…` (admin login landed on the dashboard) and `phase-b › a member posts an event…` (two "Log in" links seen during the logout transition) failed once and passed when rerun; the full suite otherwise passed (148 of 150). Not changed; both were seen flaking before (items 46, 48).
55. Requirement change (2026-10-23): "closed deals" is called "closed business" everywhere on the site (the dollar figures shown next to the count are "Closed business ($)"). Updated labels only: `member.spec` (status pill), `phase-a.spec` (leaderboard and group totals labels, including "Business closed" → "Closed business ($)", stats CSV header), `templates.test.ts` (status label passed to the referral email). Database values (`closed_deal`) are unchanged.
56. Temporary passwords (2026-10-23): new `owner-2026-10-23 › temporary password…` sets a bcrypt password and the `must_change_password` flag in the database (as done live), then checks login sends the member to "Choose your password", other pages redirect there, a short password is refused, saving clears the flag and continues to the page they asked for, and the new password works.
