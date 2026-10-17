# Mockup inventory

Source: Claude design canvas "Membership Site Mockups" (17 artboards). Read directly from the artboard source files.

Legend: **S** static · **I** interactive (client only) · **D** data-backed (Supabase) · **?** behavior unclear (see Open questions)

## Design tokens (extracted)

| Token      | Value                                                                                  | Use                              |
| ---------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| ink        | `#1f2d36`                                                                              | body text                        |
| ink-muted  | `#52626d`                                                                              | secondary text                   |
| ink-soft   | `#3d4d57`                                                                              | lead paragraphs                  |
| navy       | `#1b3644`                                                                              | headings, dark bands, footer     |
| navy-2     | `#24475a`                                                                              | cards on navy                    |
| teal       | `#17738a`                                                                              | primary buttons, links, accents  |
| teal-dark  | `#0f5566`                                                                              | hover                            |
| teal-tint  | `#e6f2f5`                                                                              | active nav, chips, date badges   |
| sky        | `#9fd3df`                                                                              | eyebrow text on navy             |
| green      | `#2c7a3a` / `#22612d`                                                                  | eyebrows, success                |
| green-tint | `#e9f3ea`                                                                              | success pills                    |
| berry      | `#9c1c4c`                                                                              | business names in directory      |
| amber      | `#7a4a0c` on `#f6ecdc`                                                                 | warning / pending pills          |
| red        | `#b42318` on `#fde8e7`                                                                 | absent, live, leave              |
| star       | `#e0a458` fill, `#b7791f` stroke                                                       | ratings, chart series 2          |
| surface    | `#ffffff`                                                                              | cards                            |
| canvas     | `#f3f7f8`                                                                              | section bands, app background    |
| line       | `#dde4e8` / `#edf1f3` / `#c5d3d9`                                                      | borders, dividers, input borders |
| Fonts      | Plus Jakarta Sans 500–800 (display), Source Sans 3 400–700 (body)                      |                                  |
| Radii      | 999px pills/buttons · 20px hero cards · 16px cards · 12–14px inputs/tiles · 10px small |                                  |

> **Changed after build (owner request, 2026-10-15):** brand colour is now `#008080`; the navy family became deep teal (`#0b3b3b`), text-on-light teal is `#006f6f` for AA contrast. The image logo was removed from the header and replaced with a text wordmark (the group name); the tab icon is a plain teal mark. The group is being renamed: all copy shows the placeholder `[New Name]` (from `src/lib/content.ts`). Current values live in `src/app/globals.css`.
>
> **Changed again (owner request, 2026-10-17):** the group is **Bay Area Referral Partners**. The header shows the logo mark (`public/images/logo-mark.png`, cropped from the owner's logo) beside a two-line wordmark; the footer and the welcome slide show the mark too; the tab icon is the mark. Home's hero has the owner's Golden Gate photo (`public/images/hero-bridge.jpg`) full width behind the text and countdown, under a dark-teal overlay. Public nav: Home, About, Meetings (`/group-meetings`), Events (`/events`, member events only), Members, Visit, Gallery.
> | Type | H1 clamp(34px, 4.4–5vw, 52–60px) 800 · H2 clamp(28px, 3.2vw, 40px) 800 · eyebrow 13px 700 uppercase .12em · body 17–18px/1.55 | |
> | Layout | max-width 1200px, 24px gutters, sections 48–72px vertical padding | |
> | Targets | buttons min-height 44–48px | |
> | Dark mode | not in mockup; must be derived (required by brief) | |

## Shared components

| Element                                                                                                              | Class | Notes                                             |
| -------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------- |
| Header: logo, 6 public links (Home, About, Events, Members, Visit, Gallery), Log in, Join [New Name]                 | S/I   | active link highlighted                           |
| Header (member): Dashboard, Meetings, Referrals, One-on-ones, Directory, Gallery, My profile, avatar + name, Log out | D     | name/initials from session                        |
| Footer: blurb, quick links, members links, proud supporter, copyright, terms/privacy                                 | S     | terms/privacy pages not in mockup (?)             |
| Countdown (days/hrs/min/sec, dark + light tones)                                                                     | D+I   | target = next meeting from DB, ticks every second |

## Public pages

### Home (`/`)

| Element                                                                                              | Class                                        |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Hero copy + "Visit a meeting free" / "Become a member"                                               | S                                            |
| Next-meeting card: countdown, date, title, 2 speakers, "Members: join in browser", "Add to calendar" | D                                            |
| Stats strip (2016, 26 member businesses, Every other Monday, $0)                                     | S (26 could be D: count of approved members) |
| How membership works (4 steps)                                                                       | S                                            |
| Upcoming events (3 cards)                                                                            | D                                            |
| Gallery teaser (3 photos)                                                                            | D                                            |
| CTA band                                                                                             | S                                            |

### About (`/about`)

History, timeline (2016/2020/Today), leadership with photo + bio, values (3 cards), three metrics (dark band), Looking ahead CTA — all **S**.

### Events (`/events`)

| Element                                                                                                           | Class          |
| ----------------------------------------------------------------------------------------------------------------- | -------------- |
| Hero + countdown card                                                                                             | D              |
| List / Calendar toggle                                                                                            | I              |
| Event cards (date badge, category, time, place, title, description, Join · RSVP & add to calendar · View details) | D              |
| Month calendar with prev/next, event chips, today highlight, legend                                               | D+I            |
| Sidebar: categories with counts, popular topics, organizers with event counts, "Want to speak?"                   | D (topics ?)   |
| "View details" target page                                                                                        | ? not designed |

### Members directory (`/members`)

| Element                                                                  | Class    |
| ------------------------------------------------------------------------ | -------- |
| Keyword search, category select, sort select                             | I over D |
| "Showing N of 26"                                                        | D        |
| Member cards (initials/logo, category, business, owner, blurb) → profile | D        |
| Pagination 1/2                                                           | D        |
| Disclaimer                                                               | S        |

### Visit (`/visit`)

| Element                                                                                                       | Class            |
| ------------------------------------------------------------------------------------------------------------- | ---------------- |
| Hero, countdown card                                                                                          | D                |
| What to expect, tips, meeting format (7 slots), how to join (4 steps)                                         | S                |
| Request a guest invite form (first, last, email, business, who invited you, which meeting) with success state | D (public write) |

### Gallery (`/gallery`)

| Element                                                           | Class                          |
| ----------------------------------------------------------------- | ------------------------------ |
| Album filter chips (All, Meetings, Mixers, Spotlights, Community) | I over D                       |
| Photo grid with caption + date                                    | D                              |
| Lightbox (prev / next / close)                                    | I                              |
| "Members: upload photos"                                          | D (upload flow not designed ?) |

### Join (`/join`) — 4-step application

| Step                            | Fields                                                                                | Class            |
| ------------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| Invited-by card (referral code) | from `?ref=`                                                                          | D                |
| 1 Account                       | first, last, email, phone, password (or email code), profile photo                    | D (auth sign-up) |
| 2 Business                      | business name, category (one per category), website, service area, ideal client, logo | D                |
| 3 Referral                      | referred by, guest meetings attended, 3 agreement checkboxes                          | D                |
| 4 Done                          | checklist: 2 guest visits, 0/3 committee one-on-ones, approval pending                | D                |

### Login (`/login`)

Tabs: "Email me a code" (send code → 6-digit code → log in) and "Password" (password, reset link); remember me; links to join/visit — **D** (Supabase Auth).

## Member pages (signed-in, approved)

### Dashboard (`/dashboard`)

Greeting + date; next meeting card (countdown, RSVP state, join, calendar); pending confirmations (confirm one-on-one, review referral); 6 KPIs (referrals given/received, one-on-ones, closed business $, attendance %, guests invited); report-activity shortcuts; activity-by-month bar chart; referral tracker summary (invited/visited/joined + link); group this month (group impact $, sessions, 3 recent items) — all **D**.

### Meeting room (`/meeting`) — **conflicts with brief** (embedded Zoom + automatic attendance). See Q1.

### Meetings & attendance (`/meetings`)

4 attendance KPIs; upcoming meetings with RSVP toggle, claim speaker slot, join; attendance history table; "request correction"; "Subscribe (Google/Outlook/iCal)" — **D**.

### Referrals (`/referrals`)

Invite link + copy + email/text/LinkedIn share; top inviters leaderboard; tabs: People I invited (funnel + table) / Business referrals (stats, table, "Log a referral" form) — **D**.

### One-on-ones (`/one-on-ones`)

Pending confirmations (confirm); report form (member search, date ≤14 days back, 1–5 private stars, private note); group impact + sessions; my one-on-ones; recent group activity with "potential duplicate"; view all records — **D**.

### Profile (`/profile`, and public `/members/[slug]`)

Public view (cover, avatar, name, business, category/city/member-since, request one-on-one, refer business, about, how to refer me, services chips, photos, contact (email/phone members-only), activity stats); Edit tab (photo, logo, fields, 3 visibility toggles, save/cancel) — **D**.

## Open questions

1. **Zoom (conflict).** The mockup embeds the meeting and logs attendance automatically from Zoom. The brief says link only, no embed. Replace the Meeting room page with a members-only "join" link, and how should attendance be recorded instead (self check-in button during the meeting window, admin marks it, or drop attendance)?
2. **Directory visibility.** The mockup's directory and profiles are public (marketing); the brief says members only. Public listing with contact details hidden, or fully members-only?
3. **Admin approval UI.** Approving sign-ups needs an admin screen, which isn't in the mockup. A minimal `/admin` approvals list, or approve in the Supabase dashboard?
4. **Email delivery.** Supabase's built-in email (sign-up confirm, codes, resets) is limited to a few emails per hour and meant for testing. A free custom SMTP (e.g. Resend free tier) is needed for real members. OK to set up?
5. **Region.** `businessgroupwebsite` is in ap-south-1 (Mumbai). Members are in California, so every page load would cross the Pacific. Keep it, or recreate in us-west-1 (needs your OK; brief says don't create projects)?
6. **Real names.** The About page names Viv Kelvin as leader with her photo (real site content, not seed data). Keep in a content file, or placeholder?
7. **"Group impact $18.42"**: what does this number mean? (Sum of closed business this month? something else?)
8. **Gallery uploads**: who can upload (any member, or admins), and is approval needed before photos go public?
9. **Event "View details"**, **Terms/Privacy**, **attendance correction request**: pages/flows not designed. Build simple versions or leave as non-links?
10. **Guest invite form**: just store the request for admins, or also email the guest the Zoom link (needs SMTP, see Q4)?
