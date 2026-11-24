// "How This Works" text for each Admin tab (owner, 2026-10-30): shown as a closed accordion under the page title.
// `summary` is the one-paragraph description under the tab menu; `steps` drop down under "Read more".
// One place to edit the wording. Keep each bullet short and plain.

export type AdminTab =
  | '/admin'
  | '/admin/guests'
  | '/admin/members'
  | '/admin/meetings'
  | '/admin/attendance'
  | '/admin/activity'
  | '/admin/champion'
  | '/admin/stats'
  | '/admin/report-cards'
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
      'What needs an admin now, pulled from every tab: attendance to take, recaps to send, guests to move along, applications to approve, open presentation slots and failed emails. Below it: the Zoom host button and a card for every admin tab.',
    steps: [
      'Items that Need Immediate Action: each line says what to do, where things stand (for guests, the stage they are at) and has a button to the tab that does it. Urgent items come first. A line disappears by itself once it is done.',
      'It checks: attendance and Zoom names for the last meeting, the Member recap (never sent automatically) and the Management recap, the absence limit, attendance correction requests, every guest from Zoom link to approval, applications, onboarding, the next meeting’s Zoom link and presentation slots, and emails that failed this week.',
      'Zoom: shows the next meeting and its Zoom number. “Start meeting as host” opens Zoom as the host; the first manager in makes the others co-hosts.',
      'Admin tabs: a short description of every tab, with a button to open it.',
    ],
  },
  '/admin/guests': {
    summary:
      'Everyone on the way to membership, in one place: the guest board, applications waiting for a decision, the visitor sign-in link for the Zoom chat, every guest invite request, new members’ onboarding and the category seats.',
    steps: [
      'Guest board: one column per step — Accept or Reject, Zoom Link Sent, Send Application Form, Application Form Accomplished, Panel Interview, Membership Approved. Cards move on by themselves when the step is done on the website. Drag a card to another column (or use “Move to” in its details) to move it by hand; that sends no emails and approves no one.',
      'Accept or Reject: check the business for a category conflict first. Accept emails the guest the Zoom link. Decline asks how you’ll tell them: “I’ll call them”, or “Send the decline email”. Declined guests are listed under “Declined”, where Reopen puts them back.',
      'Each card’s details show the guest’s contact details, everything that happened (with who did it), and a box for notes only admins see.',
      'Pending applications: people who filled in the membership application. Read their answers and references, then Approve (they get the welcome email) or Decline.',
      'Visitor sign-in link: copy it and paste it in the Zoom chat during a meeting. Visitors who came without asking for an invite fill in their details, and they appear in Guest invite requests, already marked as visited and “Signed in at the meeting”.',
      'Guest invite requests: every visitor, newest first. Send Zoom link → Mark visited (or the Zoom report does it) → Invite to apply → one-on-ones Done → Approved. The status moves by itself when they apply and when they are approved.',
      'Onboarding: who has finished their new-member onboarding, and “Sync newsletter list” to copy every approved member into the Brevo newsletter list.',
      'Category seats: how many members each profession may have (usually 1). Full categories show as taken on the Visit and Join pages.',
    ],
  },
  '/admin/members': {
    summary:
      "Open a member to edit their profile, contact phone, category, status, photo and logo, and to fix anything they filed. Every change you make to someone else's record is kept in the change history.",
    steps: [
      'Lists every member account. Open a member to change their profile, phone, category, status, photo and logo.',
      'From a member’s page you can also fix or delete the referrals, one-on-ones, events and gallery photos they filed.',
      'Only Viv, Ced, Rachanee and Shermaine can make someone an admin or remove the admin role. Nobody can change their own role.',
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
      'During the meeting, “Live attendance” at the top shows who has joined Zoom, who is late (after 8:30 AM) and who isn’t here yet, refreshed every 10 seconds. Link an unknown Zoom name to a member right there.',
      'Pick a meeting. Around noon Pacific on meeting days the site reads the Zoom participant list and marks members present, with join and leave times.',
      '“Needs review” lists Zoom names the site couldn’t match. Link each to a member (it remembers the name next time), mark it as a visitor, or ignore it.',
      'You can change anyone’s attendance by hand and save. “Sent a substitute” counts as present; “Excused” still counts as missed.',
      '“Left early” comes from Zoom, but Zoom isn’t always right: set it by hand when needed. “Excused – left early (emergency)” is for someone who told us about an emergency: they keep their 60-second infomercial at the next meeting.',
      'Members who left early (and weren’t excused) can’t do their 60-second infomercial at the next meeting. They are listed on the Overview and on Customize slides, with a PDF to download.',
      'Late = joined after 8:30 AM. Left early = left before 9:45 AM (or before the meeting really ended, if it ended earlier).',
      'The absence limit is 2 missed meetings in 6 months. Members at the limit are listed at the top and on the Overview.',
      'Attendance correction requests: members asking to fix their attendance. Fix it in the table, then mark the request resolved.',
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
      'Directory downloads: who downloaded the member directory, and when.',
    ],
  },
  '/admin/champion': {
    summary:
      'A BARP Champion at every meeting: the ranking of points earned since the previous meeting, the automatic pick, and where you confirm it or choose someone else with a reason. Lifetime points are shown too.',
    steps: [
      'Each meeting has its own champion (owner, 2026-11-23): points earned from the end of the previous meeting to the end of this one. Points reported during the meeting count.',
      'Points: 1 for each referral given, 1 for each one-on-one done (once per pair of members), 1 for attending the meeting and 1 for each visitor brought who attended. From January 2027 also 1 for a 5-minute presentation and 2 for a 10-minute presentation.',
      'To qualify, a member must attend the meeting (a substitute counts) once its attendance is taken. Ties go to more closed business, then more referrals.',
      'The slide shows the leader live: press Refresh (or R) on the slides to include points reported during the meeting.',
      'After the meeting the top qualifying member is recorded automatically, once the attendance is in (or a day later). You can confirm the pick earlier or choose someone else with a reason.',
      'The champion gets a badge on their profile and directory card until the next meeting’s champion is recorded.',
      'Lifetime points keep adding up and never reset: see the Lifetime column, or choose “Lifetime points” in the meeting list.',
    ],
  },
  '/admin/report-cards': {
    summary:
      'A report card per member for each quarter, for coaching check-ins: attendance, lateness, one-on-ones, referrals, visitors and presentations, compared with the goals you set.',
    steps: [
      'Pick a quarter. The website started tracking in October 2026, so Q4 2026 is the first one.',
      'Set the group’s quarterly goals (one-on-ones, referrals, visitors, attendance %). Leave a goal blank for no goal. Goals apply to every quarter shown.',
      'Meetings count only once their attendance was taken, and only those after the member joined. “Left early” follows the corrections made on Attendance.',
      'Closed business shows as counts only, never dollars.',
      'Download one member’s card as a PDF from their row, or every card in one PDF.',
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
      "The email members and visitors get after a meeting: today's visitors, the slides and presentations, member events and who presents next. Check it here, then send it.",
    steps: [
      'The Member recap is the email members and that meeting’s visitors get after each meeting. It is never sent automatically: you send it from this page.',
      'It welcomes the day’s visitors and thanks who invited them, links the slides and the presenters’ materials, lists member events and who presents next time.',
      'The preview below is built from the most recent meeting’s live data, exactly as members will see it (with your first name in the greeting).',
      'When it looks right, check the “Also send to” list (saved from last time; edit it and press Save list any time), press Send recap, then confirm. Each address gets it once per meeting; sending again only reaches new addresses.',
      'Tip: for a Zoom-only visitor to be listed and get the recap, mark them as a visitor on Attendance and fill in who invited them and their email (company and phone too if you have them) before you send.',
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
      'Every photo members uploaded, newest first. Only Viv, Ced, Rachanee and Shermaine see this tab.',
      'Fix a caption or date, move a photo to another album, or remove it.',
      'Members upload photos on the Gallery page. Changes you make are saved in Change history.',
    ],
  },
  '/admin/history': {
    summary:
      "Every change an admin makes to another member's profile, slots, events, photos or activity records: who, what, before and after. Below it, the Email Logs.",
    steps: [
      'Every change an admin made to another member’s profile, slots, events, photos or activity records: who made it, when, and what it was before and after.',
      'Only admins can see this list. Changes members make to their own data are not listed.',
      'Email Logs: the last 25 emails the site sent and whether they went out. Resend any that failed.',
    ],
  },
};
