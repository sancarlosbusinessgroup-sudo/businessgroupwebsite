# Phase 2 spec

Status: **decisions agreed 2026-10-16; Phase A built and deployed 2026-10-16**, waiting on a few inputs from the owner (marked **INPUT NEEDED**).
Everything here builds on the live site (Next.js + Supabase + Vercel). The rules in the original build brief still apply: tests first, RLS on every table, no secrets in the repo, fictional seed data only, free tiers only, ask before anything that creates, deletes or overwrites resources (including dropping columns).

The group is being renamed; all copy uses `site.name` / `site.shortName` from `src/lib/content.ts` (currently the placeholder `[New Name]`).

## Decisions

| #   | Topic                 | Decision                                                                                                                                                                                                                             |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Member events         | Any approved member can post. **No admin approval. Public.** Admins can edit or remove any event.                                                                                                                                    |
| 2   | Closed deals          | **No dollar amounts anywhere** (remove the field). Counts only.                                                                                                                                                                      |
| 3   | Stats visibility      | Per-member stats: **admins only**. Everyone else sees them only through the **leaderboard** and the **group totals in the meeting slides**.                                                                                          |
| 4   | Directory contacts    | **Members only** (signed-in, approved). Public sees businesses only.                                                                                                                                                                 |
| 5   | Onboarding form       | Built on the site, link emailed automatically on approval. **INPUT NEEDED:** the paper form (fields).                                                                                                                                |
| 6   | Email                 | **Brevo** (transactional emails from the site + Supabase auth emails via Brevo SMTP + newsletters written by admins in Brevo). Needs a domain.                                                                                       |
| 7   | Zoom                  | Group has **Zoom Pro**, managed by the group. Use it for automatic attendance.                                                                                                                                                       |
| 8   | Meeting agenda/slides | Welcome · Please silence your phones · For visitors (how to attend / join) · 5-minute presentation · 10-minute presentation · Summary of referrals and one-to-ones (+ leaderboard). Plus optional slides from the suggestions below. |
| 9   | Suggestions           | **All nine** included (see "Additional features").                                                                                                                                                                                   |
| 10  | Management (About)    | Admin-editable leadership list. **INPUT NEEDED:** names and roles (photos/bios later).                                                                                                                                               |
| 11  | Proud supporter       | Remove "Proud supporter: San Carlos Life" everywhere.                                                                                                                                                                                |

## Features

### 1. Member events calendar

- New "Post an event" form for approved members: title, start/end (Pacific), online link or address, description, optional image (resized in browser like gallery), category.
- Published immediately on `/events` (list + month view) and its `.ics` feeds, marked "Member event · hosted by {name}".
- Host can edit/delete own events; admins can edit/delete any.
- Table: reuse `meetings` with a `kind` (`group_meeting` | `group_event` | `member_event`) and `host_id`, or a separate `member_events` table. Decide in implementation; RLS: insert/update/delete only by host or admin, public read.
- Rate limit (e.g. 10 events per member per month) to prevent abuse.

### 2. One-to-ones without star ratings

- Remove the rating control and stored ratings (`one_on_one_feedback.rating`). Keep the optional private note.
- Dropping the column needs owner confirmation at build time.

### 3. Referrals = business passed to another member (referral slips)

- Reporting flow mirrors one-to-ones: **giver files a referral slip** → receiver is notified → receiver updates status.
- Slip fields: receiving member, prospect name, prospect phone/email (optional), temperature (hot/warm/cold), notes, "prospect has agreed to be contacted" checkbox.
- Statuses: `new` → `contacted` → `meeting_set` → `closed_deal` | `not_a_fit`. A **closed deal** is a referral the receiver marks as having produced business. **No amount.**
- Remove `referrals.amount` (needs confirmation). Existing seeded amounts are discarded.
- Guest invitations ("invite a visitor", `/visit?ref=`) move out of the referrals page into a separate "Invite a visitor" card (dashboard), counted as **visitors brought** (feature A2).

### 4. Stats: one-to-ones, referrals, closed deals

- Three counts, per member and for the whole group, for: this meeting cycle / week, month, quarter, year, all time, custom range.
- Counting rules: one-to-one counts for **both** members once confirmed; referral counts for the **giver** when filed; closed deal counts for the **giver** (the referral they passed produced business) and is shown as "closed deals received" for the receiver in admin view.
- **Admin stats page** (`/admin/stats`): table of every member × three counts × period, sortable, CSV export.
- **Leaderboard** (members and slides): top 5 per metric for the chosen period. Names + counts only.
- Members' own dashboards: remove per-member stat tiles unless the owner decides otherwise (see open questions).
- Replace the current `member_stats` / `group_month_stats` / `top_inviters` RPCs accordingly; keep them security-definer with admin checks.

### 5. Meeting slide presentation

- `/present/[meeting]` and `/present/next`: full-screen HTML deck, keyboard (←/→, space), clicker-friendly, works in Zoom screen share, 16:9, readable at a distance. Admin/member only.
- Slides, auto-filled from the database:
  1. Welcome (group name, date, meeting number)
  2. Please silence your phones
  3. For visitors: what the group is, how to visit/join, open categories (A1)
  4. New members & today's visitors (A2)
  5. Weekly specific asks (A3) — optional, may span several slides
  6. **5-minute presentation**: presenter photo, name, business, topic
  7. **10-minute presentation**: presenter photo, name, business, topic
  8. Summary: group totals of one-to-ones, referrals, closed deals for last cycle / month / year
  9. Leaderboards (one-to-ones, referrals, closed deals, visitors brought)
  10. Upcoming events (group + member events)
  11. Next meeting's presenters + closing
- Speaker slots: rename to "5-minute" and "10-minute"; claiming a slot asks for the **topic** (and optional short description).
- Admin can toggle optional slides and reorder per meeting; defaults follow the agreed agenda.

### 6. Automatic attendance (Zoom Pro)

- Admin creates a **Server-to-Server OAuth app** in the group's Zoom account (scopes for past-meeting participant reports). Credentials stored only as Vercel env vars (server-side).
- After each meeting ends (Vercel cron, free tier: daily schedule or triggered from the admin page), the site fetches the participant report for the meeting's Zoom ID, matches participants to members by **email** (fallback: name), and records attendance (present, minutes attended).
- Unmatched participants go to an admin review list (link to a member, mark as visitor, or ignore). Visitors matched to guest requests are marked "visited".
- Self check-in via "Join on Zoom" stays as a fallback.
- Note for members: matching by email works best if they join signed in to Zoom with the same email as their site account; optionally enable "registration required" on the Zoom meeting.

### 7. Approval → onboarding form

- When an admin approves an applicant, the site emails them (Brevo) a link to `/onboarding`.
- Onboarding form fields: **INPUT NEEDED** (paper form). Will include consent: "My contact details are shared with members" and agreement to the group's commitments.
- Admin sees onboarding status per member; reminder email after 3 days if incomplete.

### 8. About page: Management section

- `leadership` table (name, role, photo, bio, sort order, optional link to member profile). Admin-editable at `/admin/leadership`. Shown on About.

### 9. Directory: contacts + download

- Signed-in members see email, phone, website on cards and profiles (already true on profiles; add to cards).
- Members-only downloads: **Excel/CSV** and **vCard (.vcf)** of all approved members who are listed in the directory.
- Respect `show_in_directory`; downloads are logged (who/when) for admins.

### 10. Email system (Brevo)

- Owner tasks: buy a domain (after the new name is chosen), create a Brevo account, verify the domain (DNS records), create an API key and SMTP key.
- Supabase Auth → custom SMTP = Brevo SMTP (confirmations, password reset, email codes).
- Site sends transactional emails through the Brevo API (server-side only): approval + onboarding link, referral received, referral status changed, one-to-one confirmation request, meeting reminder with Zoom link (morning of), weekly digest (admins), event posted (optional).
- Member list synced to a Brevo contact list so admins can send newsletters from Brevo's editor. Unsubscribe respected for newsletters; transactional emails always sent.
- Free tier: 300 emails/day.

## Additional features (all nine suggestions)

- **A1 Open categories ("one member per profession")**: categories have `seat_limit` (default 1); Visit/Join pages and the visitor slide show which professions are open; join form warns if a category is full.
- **A2 Visitor pipeline**: QR-code guest sign-in for in-person meetings; Zoom-matched visitors; thank-you email to visitor; follow-up reminder to the inviting member; "visitors brought" stat and leaderboard.
- **A3 Weekly specific ask**: one line per member ("This week I'm looking for…"), shown in directory and slides; editable anytime.
- **A4 Attendance policy**: rolling 6-month absences per member, substitutes count as present, admin alert near the limit. **INPUT NEEDED:** the group's absence limit.
- **A5 Notification emails**: as listed in feature 10, with per-member preferences.
- **A6 Phone app (PWA)**: installable to home screen; fast referral-slip and one-to-one forms.
- **A7 Officer roles**: roles beyond admin (e.g. President, Vice President, Secretary/Treasurer, Membership Committee) with scoped permissions. **INPUT NEEDED:** role list.
- **A8 Member spotlight & testimonials**: public spotlight section and testimonials submitted by members, admin-approved.
- **A9 Admin import**: upload a spreadsheet of members to create accounts in bulk (sends set-password emails via Brevo).

## Build order

1. **Phase A — Core changes:** remove star ratings and San Carlos Life credit; referral slips + closed deals (no amounts); stats + admin stats page + leaderboard; Management section; directory contacts on cards + CSV/vCard download; specific ask (A3); open categories (A1).
2. **Phase B — Events & slides:** member events calendar; speaker topics; meeting slide deck.
3. **Phase C — Email (needs domain + Brevo):** Brevo SMTP for auth, transactional emails, onboarding form + approval email, notifications (A5), contact-list sync, visitor follow-ups (A2).
4. **Phase D — Zoom attendance:** report import, matching, admin review; attendance policy (A4).
5. **Phase E — Extras:** PWA (A6), officer roles (A7), spotlight/testimonials (A8), import tool (A9), weekly backups to GitHub.

Each phase: tests first (unit, DB/RLS, E2E + axe at 375/768/1280, light/dark), deploy, owner test.

## Phase A: built 2026-10-16

Migration `supabase/migrations/20261016000001_phase_a.sql` (drops approved by the owner the same day). Choices made during the build:

- **Referral slips** keep the database column `contact_name` (shown as "Prospect name"). Status `sent` was renamed `new`, `closed` → `closed_deal`, `meeting_set` added; temperature `tip` → `cold`. `closed_at` is stamped by a trigger when the receiver marks a closed deal and is what closed-deal counts use.
- **Periods** are Pacific calendar dates. "This meeting cycle" = from the date of the most recent group meeting to today. Week starts Monday.
- **Visitors brought** = guest requests credited to the member whose guest actually visited (status visited, applied or joined). Shown on the leaderboard and admin stats now, since it replaces the old "top inviters" list.
- **Leaderboard** on the dashboard (this month by default; quarter, year, all time), top 5 per metric, names + counts only. Members' personal stat tiles, monthly chart and $ figures are gone; the public "activity" box on profiles is gone.
- **Invite a visitor** card (link, share buttons, own recent guests) moved to the dashboard; the referrals page is now only referral slips (received / given).
- **Management**: `leadership` table, edited at `/admin/leadership`. Photo = the linked member's profile photo (no separate upload yet). While the list is empty, About keeps the original leadership text, so the live site is unchanged until admins add people.
- **Directory**: members see email/phone/website on cards; CSV (opens in Excel) and vCard downloads are logged in `directory_downloads` and listed on `/admin`.
- **Weekly ask**: edited on the dashboard or profile, shown on directory cards and profiles (public, like "Listen for").
- **Open categories**: `categories.seat_limit` (default 1) replaces the one-per-category index; a trigger blocks approving into a full category; admins change seats on `/admin`. Visit lists open professions (except "Other"); Join marks full categories and warns, but still lets people apply.

Still open for the owner: one-on-ones remain visible to all members as a group feed (dashboard / one-on-ones page) as before; say if that should become private to the two members.

## Inputs needed from the owner

- New group name → then domain → then Brevo.
- Paper onboarding form.
- Leadership names and roles (photos/bios later).
- Attendance policy (absence limit, substitutes).
- Officer role list.
- Zoom: an admin to create the Server-to-Server OAuth app (guided at Phase D).

## Open questions (defaults used unless the owner says otherwise)

- Members' own stats on their dashboard: **default hidden** (per decision 3). Owner may allow members to see only their own counts.
- Leaderboard on the members' dashboard as well as slides: **default yes**.
- Meeting cadence stays **every other Monday, 8:15 AM PT**.
