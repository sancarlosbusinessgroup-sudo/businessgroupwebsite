// "How This Works" text for each Admin tab (owner, 2026-10-30): shown as a closed accordion under the page title.
// `summary` is the one-paragraph description under the tab menu; `steps` drop down under "Read more".
// One place to edit the wording. Keep each bullet short and plain.

export type AdminTab =
  | '/admin'
  | '/admin/members'
  | '/admin/meetings'
  | '/admin/attendance'
  | '/admin/activity'
  | '/admin/champion'
  | '/admin/stats'
  | '/admin/leadership'
  | '/admin/recap'
  | '/admin/management-recap'
  | '/admin/materials'
  | '/admin/gallery'
  | '/admin/history';

export type AdminHelp = { summary: string; steps: string[] };

export const adminHelp: Record<AdminTab, AdminHelp> = {
  '/admin': {
    summary:
      "Everything that needs an admin's attention, in one place: the next Zoom meeting, the visitor sign-in link, applications and guest requests waiting on you, and the site's email activity.",
    steps: [
      'Zoom: shows the next meeting and its Zoom number. “Start meeting as host” opens Zoom as the host; the first manager in makes the others co-hosts.',
      'Visitor sign-in link: copy it and paste it in the Zoom chat during a meeting. Visitors who came without asking for an invite fill in their details, and they appear in Guest invite requests, already marked as visited and “Signed in at the meeting”.',
      'Pending applications: people who filled in the membership application. Read their answers and references, then Approve (they get the welcome email) or Decline.',
      'Guest invite requests: every visitor, newest first. Send Zoom link → Mark visited (or the Zoom report does it) → Invite to apply → one-on-ones Done → Approved. The status moves by itself when they apply and when they are approved.',
      'Attendance correction requests: members asking to fix their attendance. Fix it on the Attendance tab, then mark the request resolved.',
      'Category seats: how many members each profession may have (usually 1). Full categories show as taken on the Visit and Join pages.',
      'Onboarding & email: who has finished their new-member onboarding, the last 25 emails the site sent (resend any that failed), and “Sync newsletter list” to copy every approved member into the Brevo newsletter list.',
      'Directory downloads: who downloaded the member directory, and when.',
    ],
  },
  '/admin/members': {
    summary:
      "Open a member to edit their profile, contact phone, category, status, photo and logo, and to fix anything they filed. Every change you make to someone else's record is kept in the change history.",
    steps: [
      'Lists every member account. Open a member to change their profile, phone, category, status, photo and logo.',
      'From a member’s page you can also fix or delete the referrals, one-on-ones, events and gallery photos they filed.',
      'Owners (Viv, Ced, Rachanee and Shermaine) can make someone an admin or remove the admin role. Nobody can change their own role.',
      'Admins can’t change a member’s sign-in email; members change it themselves in My profile.',
      'Every change you make to someone else’s record is saved in Change history.',
    ],
  },
  '/admin/meetings': {
    summary:
      'Open a meeting to change its date, time or Zoom link, and to revoke or assign the 5- and 10-minute presentation slots. Cancel a meeting for a holiday or hide one from the website; both can be undone here.',
    steps: [
      'Lists the upcoming group meetings (switch to past meetings at the top). Open one to change its date, time, title or Zoom link.',
      'Inside a meeting you can see RSVPs and revoke or assign the 5- and 10-minute presentation slots; the member is emailed when their slot changes.',
      'Cancel a meeting for a holiday (it stays listed, marked cancelled) or Hide it from the website. Restore or Show undoes it.',
      '“Add meetings for the next 12 months” adds a meeting every other Monday after the last one, with the same time and title. Add the Zoom links afterwards.',
      'Removing a meeting deletes it for good, with its RSVPs, attendance and slots. Use Cancel instead if you want it to stay listed.',
    ],
  },
  '/admin/attendance': {
    summary: 'Who was at each meeting, read from Zoom or taken by hand, with late arrivals, early leavers and who is near the absence limit.',
    steps: [
      'Pick a meeting. Around noon Pacific on meeting days the site reads the Zoom participant list and marks members present, with join and leave times.',
      '“Needs review” lists Zoom names the site couldn’t match. Link each to a member (it remembers the name next time), mark it as a visitor, or ignore it.',
      'You can change anyone’s attendance by hand and save. “Sent a substitute” counts as present; “Excused” still counts as missed.',
      'Late = joined after 8:30 AM. Left early = left before 9:30 AM.',
      'The absence limit is 2 missed meetings in 6 months. Members at the limit are listed at the top and on the Overview.',
      'If Zoom isn’t connected, take attendance by hand; it counts the same.',
    ],
  },
  '/admin/activity': {
    summary:
      'Referral slips, one-on-ones and member events, newest first. Delete a duplicate or a mistake here; it is removed for everyone and from the stats.',
    steps: [
      'Every referral slip, one-on-one and member event, newest first.',
      'Delete a duplicate or a mistake here. It is removed for everyone and from the stats, leaderboard and BARP Champion points.',
      'To edit (rather than delete) something a member filed, open that member on the Members tab.',
    ],
  },
  '/admin/champion': {
    summary: "The month's ranking by points, the automatic pick, and where you confirm the champion or choose someone else with a reason.",
    steps: [
      'Points per month: 1 for each referral given, 1 for each one-on-one done (once per pair of members) and 1 for each meeting attended.',
      'To qualify, a member must attend at least 75% of the month’s meetings that had attendance taken.',
      'The top qualifying member is the automatic pick. Ties go to more closed business, then more referrals.',
      'You can confirm the automatic pick or choose someone else with a reason. The champion gets a badge on their profile and directory card, and appears on the BARP Champion slide.',
      'If nobody is chosen, the slide shows the member leading the month so far.',
    ],
  },
  '/admin/stats': {
    summary:
      'Per-member counts for any period: one-on-ones, referrals, closed business and visitors. Admins only; members see the leaderboard and group totals.',
    steps: [
      'Per-member counts for the period you choose: one-on-ones, referrals given and received, closed business given and received with its dollar value, and visitors brought.',
      'Only admins see these numbers. Members see the leaderboard and group totals on their dashboard.',
      'A confirmed one-on-one counts for both members. Referrals and closed business count for the member who gave the referral.',
      'Sort by any column, and download the table as a CSV file for a spreadsheet.',
    ],
  },
  '/admin/leadership': {
    summary: 'The people listed here appear in the Management section of the About page and on the Management Team slide, in sort order.',
    steps: [
      'The people listed here show in the Management section of the About page and on the Management Team slide, in sort order.',
      'Add a person, give them a role (for example “Time Manager · Membership Committee”), link them to their member profile so their photo shows, and set the order.',
      'While the list is empty, the About page shows the original leadership text.',
    ],
  },
  '/admin/recap': {
    summary:
      "The email every member gets after a meeting: today's visitors, the slides and presentations, member events and who presents next. Preview it and switch it on or off here.",
    steps: [
      'The Member recap is the email every member gets after each meeting, around noon Pacific.',
      'It welcomes the day’s visitors and thanks who invited them, links the slides and the presenters’ materials, lists member events and who presents next time.',
      'The preview below is built from the most recent meeting’s live data, exactly as members will see it (with your first name in the greeting). Nothing is sent from this page.',
      'Use the switch to turn the automatic Member recap off or on. Turn it off before noon on a meeting day to stop that meeting’s recap.',
      'Members can turn the recap off for themselves in My profile → Edit → Email notifications.',
    ],
  },
  '/admin/management-recap': {
    summary:
      "The attendance email the Management Team gets after each meeting, with the day's visitors and notes on what needs attention. Preview it and switch it on or off here.",
    steps: [
      'The Management recap goes to every admin (the Management Team) after each meeting, once that meeting’s attendance has been taken.',
      'It lists who was present, late, left early, sent a substitute or was absent, the day’s visitors and who invited them, and notes for the team: members at the absence limit, Zoom names still to review, applications and guests waiting, and open presentation slots.',
      'It is sent around noon Pacific after the Zoom attendance is read. If attendance hasn’t been taken by the next morning, it goes out then with a note to take it.',
      'The preview below is built from the most recent meeting’s live data. Nothing is sent from this page.',
      'Use the switch to turn the automatic Management recap off or on.',
    ],
  },
  '/admin/materials': {
    summary: 'Every file, video and website link presenters added to their presentations, newest meeting first, with how much storage they use.',
    steps: [
      'Every file, video and website link presenters added to their 5- and 10-minute presentations, newest meeting first.',
      'Space used shows how much of the free 1 GB file storage the uploaded files take. Videos and website links take no file storage.',
      'Delete old files here to free up space. Materials are added on each meeting’s Customize slides page.',
    ],
  },
  '/admin/gallery': {
    summary: 'Every photo members have uploaded, newest first. Fix a caption, move a photo to another album, or remove it.',
    steps: [
      'Every photo members uploaded, newest first.',
      'Fix a caption or date, move a photo to another album, or remove it.',
      'Members upload photos on the Gallery page. Changes you make are saved in Change history.',
    ],
  },
  '/admin/history': {
    summary: "Every change an admin makes to another member's profile, slots, events, photos or activity records: who, what, before and after.",
    steps: [
      'Every change an admin made to another member’s profile, slots, events, photos or activity records: who made it, when, and what it was before and after.',
      'Only admins can see this list. Changes members make to their own data are not listed.',
    ],
  },
};
