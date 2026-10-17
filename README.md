# Bay Area Referral Partners website

Members' hub for the business networking group Bay Area Referral Partners: public pages (home, about, group meetings, member events, member directory, visit, gallery, bylaws), sign-up with admin approval, and a members area (dashboard, meetings & attendance, referral tracker, one-on-ones, profile, admin).

- **Stack:** Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Vercel
- **Design source:** the membership site mockups canvas. Element inventory in [`docs/mockup-inventory.md`](docs/mockup-inventory.md)
- **Tests:** Vitest + React Testing Library (unit), Vitest + Postgres (database security), Playwright + axe (end-to-end + accessibility). Checklist in [`docs/test-plan.md`](docs/test-plan.md)

## 1. Local setup

Requirements: Node 20.9+, and for the test stack, Postgres 16 server binaries (`postgresql-16` on Ubuntu/Debian, `brew install postgresql@16` on macOS).

```bash
npm install
cp .env.example .env.local      # then fill in values (see below)
npm run dev                     # http://localhost:3000
```

To develop against a local database instead of the cloud project:

```bash
npm run stack:start             # Postgres + Supabase Auth + PostgREST + mail catcher, on ports 54321–54326
```

Then point `.env.local` at it:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<output of: node scripts/local-stack/keys.mjs anon>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Emails sent locally (confirmations, login codes, resets) are captured at `http://127.0.0.1:54326/messages`.
`npm run stack:stop` stops it; `npm run stack:reset` rebuilds the database from migrations + seed.

## 2. Environment variables

| Name                            | Where it's used                 | Where to find it                                                                                                         |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | browser + server                | Supabase → Project Settings → API → Project URL                                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server                | Supabase → Project Settings → API → `anon` public key                                                                    |
| `NEXT_PUBLIC_SITE_URL`          | links in emails, calendar files | Your site URL, e.g. `https://businessgroupwebsite.vercel.app` (on Vercel, falls back to the project's production domain) |

The app never uses the service-role key. `.env.local` is git-ignored; `.env.example` holds placeholders only.

## 3. Database migrations

SQL lives in `supabase/migrations/` (applied in filename order) and sample data in `supabase/seed.sql`.

- **Cloud project:** paste each migration into Supabase → SQL Editor and run, in order. Or, with the Supabase CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
- **Seed (optional, sample data):** run `supabase/seed.sql` in the SQL Editor. Everyone in it is fictional (`@example.com`) and has no password, so nobody can sign in as them. Re-running it replaces only its own rows. To remove it later: `delete from auth.users where email like '%@example.com' and id::text like '00000000-0000-4000-8000-%';`
- **Local:** `npm run stack:reset`.

Every table has Row Level Security enabled with explicit policies (`20261015000002_rls.sql`). Highlights:

- Visitors see approved, listed members, meetings, speakers and the gallery, and can submit a guest request (rate-limited in the database).
- Contact details (and the CSV / vCard directory downloads, which are logged), Zoom links, one-on-ones, the leaderboard and group totals require an **approved** member.
- Members only see referral slips they're part of; only the receiver can change the status (e.g. to a closed deal). There are no dollar amounts.
- Per-member stats (`admin_member_stats`) are **admins only**; members see only the leaderboard (names + counts) and group totals.
- Private one-on-one notes are visible only to their author (and admins).
- Each category has a seat limit (default 1); the database refuses to approve a member into a full category.
- Members can't change their own status, role or referral code (database trigger).
- Uploads go to the public `gallery` and `profile-media` buckets, only inside the uploader's own folder.

### Making the first admin

1. Sign up through `/join` with your own email and confirm it.
2. In Supabase → SQL Editor:
   ```sql
   update public.profiles set status = 'approved', role = 'admin'
   where id = (select id from auth.users where email = 'you@example.org');
   ```
3. Log in and open `/admin` to approve applicants, manage guest requests and set category seats. `/admin/stats` has per-member counts for any period (with CSV export) and `/admin/leadership` edits the Management list on the About page.

Attendance corrections and Zoom links are edited in Supabase → Table Editor (`attendance`, `meeting_links`). Meetings and events go in the `meetings` table.

## 4. Email (Supabase Auth + Resend)

Supabase's built-in email only sends a few messages per hour and is meant for testing. For real members:

1. Create a free account at [resend.com](https://resend.com), verify your sending domain, and create an API key.
2. Supabase → Authentication → Emails → SMTP Settings → enable custom SMTP: host `smtp.resend.com`, port `465`, user `resend`, password = the API key, sender e.g. `no-reply@yourdomain`.
3. Supabase → Authentication → URL Configuration: set **Site URL** to the live URL and add `https://<your-site>/auth/callback` to **Redirect URLs**.
4. Supabase → Authentication → Emails → **Magic Link** template: replace the body with the following so "Email me a code" works:
   ```html
   <h2>Your sign-in code</h2>
   <p>Your code is: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">log in with this link</a>.</p>
   ```

## 5. Running tests

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript strict
npm test              # unit tests (Vitest + React Testing Library)
npm run stack:start   # needed for the next two
npm run test:db       # Row Level Security + trigger tests against the local database
npm run build && npm run test:e2e   # Playwright end-to-end + axe accessibility (starts `next start` if not running)
```

`npm run test:all` runs everything in order. To smoke-test a deployed site (read-only pages): `E2E_BASE_URL=https://<site> npx playwright test tests/e2e/public.spec.ts --grep-invert "guest invite form"`.

## 6. Deploying (Vercel)

1. Vercel → Add New → Project → import `businessgroupwebsite` from GitHub (framework: Next.js, defaults).
2. Add the three environment variables above for Production and Preview.
3. Deploy. Pushes to `main` deploy to production; pull requests get preview URLs.
4. After the first deploy, update Supabase's Site URL / Redirect URLs (section 4).

## Changing the group name

The group is **Bay Area Referral Partners** (set 2026-10-17). To change it again:

1. Edit `name` (full name) and `shortName` (header, page titles, buttons) in `src/lib/content.ts`. Every page reads them from there.
2. In Supabase → SQL Editor, update the meeting titles and descriptions:
   ```sql
   update public.meetings set
     title = replace(title, 'Bay Area Referral Partners', 'Real Name'),
     description = replace(description, 'Bay Area Referral Partners', 'Real Name');
   ```
3. Replace the logo files: `public/images/logo-mark.png` (header, footer, welcome slide), `public/images/logo.png` (full logo), `src/app/icon.png` and `src/app/apple-icon.png` (browser tab and phone home screen).
4. Update the sender name in Supabase → Authentication → SMTP Settings, and the email templates if they mention the name.

## Project layout

```
src/app/            routes (public pages, members area, auth callback, server actions in actions/)
src/components/     shared UI (header, footer, countdown, forms, profile view, leaderboard, invite card)
src/lib/            data access, validation (Zod), dates, content, Supabase clients
supabase/           migrations + seed
scripts/local-stack local Supabase-compatible stack for tests
tests/db, tests/e2e database and end-to-end tests
docs/               mockup inventory, test plan, phase 2 spec
```
