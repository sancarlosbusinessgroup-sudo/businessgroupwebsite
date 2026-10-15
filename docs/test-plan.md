# Test plan

Requirement numbers refer to the build brief: **R1** pages reproduced · **R2** interactions work · **R3** Supabase schema, RLS, seed · **R4** auth + approval · **R5** forms (validation, errors, states) · **R6** empty/loading/error states · **R7** repo + README · **R8** deploy. **A11y** = WCAG 2.1 AA (axe).

Status as of the last full run (all from a freshly reset local stack, in `npm run test:all` order): **Unit 30/30 · Database 28/28 · E2E 71/71 (43 desktop + 14 tablet 768px + 14 phone 375px)**. Lint, type-check and Prettier: clean.

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
| validation › referral needs member + contact; closing needs amount                                              | R5            | passing |
| validation › one-on-one date within last 14 days                                                                | R5            | passing |
| validation › profile splits services, checkboxes → booleans                                                     | R5            | passing |
| directory › keyword matches business/name/category/about; category + sort                                       | R2            | passing |
| directory › paginate clamps pages                                                                               | R2            | passing |
| stats › attendance %, bar heights, duplicate one-on-one flags                                                   | R1            | passing |
| attendance › missing records = absent, streak; excused keeps streak                                             | R1            | passing |
| ics › calendar file escaping + UTC times                                                                        | R2            | passing |
| images › accepts photos ≤25 MB, rejects other types/oversize                                                    | R5            | passing |
| Countdown › ticks every second (role=timer) / "starting now"                                                    | R2 A11y       | passing |
| StarRating › labelled radio group, keyboard arrows                                                              | R5 A11y       | passing |

## Database security (Vitest + Postgres): `npm run test:db`

| Test                                                                                                 | Covers | Status                                              |
| ---------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------- |
| RLS enabled on every public table                                                                    | R3     | passing                                             |
| anon: sees only approved listed members                                                              | R3     | passing                                             |
| anon: cannot read contacts, Zoom links, attendance, referrals, one-on-ones, feedback, guest requests | R3 R4  | passing                                             |
| anon: can read meetings, speakers, gallery, categories                                               | R3     | passing                                             |
| anon: guest request credits referrer                                                                 | R3     | passing                                             |
| anon: cannot forge guest status/referrer                                                             | R3     | passing                                             |
| anon: cannot call member-only functions                                                              | R3     | passing                                             |
| anon: cannot write members/meetings                                                                  | R3     | passing                                             |
| pending: can read/edit own profile                                                                   | R4     | passing                                             |
| pending: cannot self-approve or become admin                                                         | R4     | passing                                             |
| pending: no contacts, Zoom links, one-on-ones                                                        | R4     | passing                                             |
| pending: cannot join meetings or send referrals                                                      | R4     | passing                                             |
| member: sees contacts + Zoom links                                                                   | R3 R4  | passing                                             |
| member: only own referrals                                                                           | R3     | passing                                             |
| member: can refer as self, not as others                                                             | R3     | passing                                             |
| member: only receiver can close a referral                                                           | R3     | passing                                             |
| member: cannot read others' private ratings                                                          | R3     | passing                                             |
| member: one-on-one older than 14 days rejected                                                       | R3 R5  | passing                                             |
| member: sees only own attendance                                                                     | R3     | passing                                             |
| join_meeting: returns link, records attendance only in window                                        | R2 R3  | passing                                             |
| member: cannot write attendance directly                                                             | R3     | passing                                             |
| member_stats: self ok, others refused                                                                | R3     | passing                                             |
| admin: approve stamps member_since                                                                   | R4     | passing                                             |
| admin: reads guest requests + pending profiles                                                       | R4     | passing (needs a freshly seeded DB, see change log) |
| storage: upload only into own folder; pending cannot upload                                          | R3     | passing                                             |
| sign-up trigger: pending profile + contact from metadata                                             | R4     | passing                                             |
| sign-up trigger: ignores self-assigned status/role                                                   | R4     | passing                                             |
| seed: regular meetings are Mondays 8:15–9:30 AM Pacific in any session time zone                     | R3     | passing (added after a deploy bug, see below)       |

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
| one-on-one: errors → report → partner confirms                                                                                              | R3 R5      | passing              |
| referral: errors → send → receiver must give amount → closed                                                                                | R3 R5      | passing              |
| invite link copy                                                                                                                            | R2         | passing              |
| profile edit: website error → save → public profile shows it                                                                                | R3 R5      | passing              |
| non-admin sent away from /admin                                                                                                             | R4         | passing              |
| admin marks guest visited                                                                                                                   | R3 R4      | passing              |

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

### Proposed (awaiting approval, not applied)

- `rls › admins › can read guest requests and pending profiles` asserts exactly **1** pending profile, so it fails if E2E tests ran first without a DB reset. Proposal: assert the seeded pending applicant is in the result instead of an exact count. Until approved, run `npm run stack:reset` before `npm run test:db` (as `test:all` order implies).
