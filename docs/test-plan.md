# Test plan

Requirement numbers refer to the build brief: **R1** pages reproduced · **R2** interactions work · **R3** Supabase schema, RLS, seed · **R4** auth + approval · **R5** forms (validation, errors, states) · **R6** empty/loading/error states · **R7** repo + README · **R8** deploy. **A11y** = WCAG 2.1 AA (axe). **PA** = Phase A of `docs/phase-2-spec.md`.

Status as of the last full run (2026-10-16, freshly reset local stack, `npm run test:all` order): **Unit 48/48 · Database 46/46 · E2E 88/88 (58 desktop + 15 tablet 768px + 15 phone 375px)**. Lint, type-check, Prettier and `next build`: clean.

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
| validation › referral slip: prospect phone/email checked, hot/warm/cold, consent checkbox                       | PA R5         | passing |
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
| RSVP toggle saved                                                                                                                           | R2 R3      | passing              |
| claim/release speaker slot                                                                                                                  | R2 R3      | passing              |
| Zoom link opens stored URL                                                                                                                  | R2 R3      | passing              |
| attendance correction: validation + saved                                                                                                   | R5         | passing              |
| one-on-one: errors → report → partner confirms (no stars)                                                                                   | R3 R5      | passing              |
| referral slip: errors → send with prospect phone + consent → receiver marks closed deal (closed_at verified in DB)                          | R3 R5 PA   | passing              |
| invite link copy (now on the dashboard "Invite a visitor" card)                                                                             | R2 PA      | passing              |
| profile edit: website error → save → public profile shows it                                                                                | R3 R5      | passing              |
| non-admin sent away from /admin                                                                                                             | R4         | passing              |
| admin marks guest visited                                                                                                                   | R3 R4      | passing              |

### Phase A end-to-end tests (`tests/e2e/phase-a.spec.ts`)

| Test                                                                                              | Status               |
| ------------------------------------------------------------------------------------------------- | -------------------- |
| footer has no "Proud supporter" / San Carlos Life credit                                          | passing              |
| About shows the Management list from the database                                                 | passing              |
| visitors: directory shows businesses only; no contacts, no downloads; export URL → login          | passing              |
| public profiles show no per-member activity stats                                                 | passing              |
| Visit lists open professions; Join marks full categories and warns                                | passing              |
| dashboard: leaderboard (4 metrics, period switch), group totals, invite card; no personal tiles/$ | passing              |
| weekly ask: save on dashboard → shown in directory                                                | passing              |
| directory cards show contacts; CSV + vCard downloads with expected content; both logged           | passing              |
| one-on-one form has no star rating                                                                | passing              |
| members cannot open admin stats or its CSV export                                                 | passing              |
| admin pages render, no console errors, axe clean @responsive                                      | passing ×3 viewports |
| admin stats: period, custom range, sort (aria-sort), CSV export                                   | passing              |
| Management: validation → add → shown on About → edit → remove                                     | passing              |
| category seats: raise limit → profession opens on Visit → reset                                   | passing              |
| admin sees the directory download log                                                             | passing              |

### Not covered by automated tests (and why)

- **Photo upload to Storage** (gallery, profile photo/logo): the local test stack has no Storage server. Covered by the storage RLS tests, the file-check unit test, and a manual check after deploy.
- **Loading skeleton** (`app/loading.tsx`): appears only on slow networks; verified manually.
- **Production smoke test**: to run against the live URL after deploy (`E2E_BASE_URL=…`).

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
10. Real issue found by axe at 375px: the directory-download table's scroll area wasn't keyboard-focusable. Fixed in the page (focusable labelled region); the test was not changed.
