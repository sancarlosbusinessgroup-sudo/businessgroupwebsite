// Site copy that rarely changes. Everything that members create lives in Supabase.

export const site = {
  name: 'Bay Area Referral Partners',
  shortName: 'Bay Area Referral Partners',
  timezone: 'America/Los_Angeles',
  founded: 2016,
  meetingCadence: 'Every other Monday',
  meetingTime: '8:15 AM',
  serviceArea:
    // Owner meeting 2026-10-30: no city list (it always missed towns); the wider area instead.
    'the San Francisco Bay Area and Northern California',
};

export const publicNav = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/group-meetings', label: 'Meetings' },
  { href: '/events', label: 'Events' },
  { href: '/members', label: 'Members' },
  { href: '/visit', label: 'Visit' },
  { href: '/gallery', label: 'Gallery' },
] as const;

/** `keepWith`: menu entries with the same value stay side by side when the menu wraps to a second row. */
export type NavItem = { href: string; label: string; keepWith?: string; children?: readonly { href: string; label: string }[] };

export const memberNav: readonly NavItem[] = [
  // Owner 2026-10-30: Home first, same page as the logo.
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/meetings', label: 'Meetings' },
  {
    href: '/referrals',
    label: 'Report Activity',
    children: [
      { href: '/referrals', label: 'Referrals' },
      { href: '/one-on-ones', label: 'One-on-ones' },
      { href: '/closed-business', label: 'Closed Businesses' },
      // Owner meeting 2026-10-30: members log the visitors they brought.
      { href: '/visitors-brought', label: 'Visitors brought' },
    ],
  },
  { href: '/members', label: 'Directory' },
  { href: '/gallery', label: 'Gallery' },
  // Owner, 2026-10-31: member events, beside Gallery.
  { href: '/events', label: 'Events' },
  // "My profile" sits top right with Admin and Log out (owner, 2026-10-30).
  // Owner 2026-10-30: "Invite A Guest" sits right next to Support, even when the menu wraps.
  { href: '/invite-guest', label: 'Invite A Guest', keepWith: 'help' },
  // Owner 2026-11-24: Support is a dropdown: "Video Guides" (new) and "Contact Us" (the original Support page).
  {
    href: '/support',
    label: 'Support',
    keepWith: 'help',
    children: [
      { href: '/video-guides', label: 'Video Guides' },
      // Owner 2026-11-24: the rules from the Bylaws and Procedures.
      { href: '/rules', label: 'Rules' },
      { href: '/support', label: 'Contact Us' },
    ],
  },
] as const;

/**
 * Member's Guide video chapters on /video-guides (owner, 2026-11-24). Recorded on a private copy of the site with
 * made-up sample members; files in public/videos/members-guide/ (H.264 MP4, 1920×1080, no sound, captions burned in),
 * poster frames beside them as .webp.
 */
export const memberGuideVideos = {
  full: { file: 'members-guide-full', title: "Member's Guide: the full tour", duration: '13:43' },
  chapters: [
    { file: '01-logging-in', title: 'Logging in for the first time', duration: '1:03', text: 'Log in, use your temporary password and choose your own.' },
    { file: '02-onboarding', title: 'Finishing your onboarding', duration: '1:01', text: 'Headshot and logo, your details, and the two agreements.' },
    { file: '03-dashboard', title: 'Your Dashboard', duration: '1:09', text: 'Next meeting, leaderboard, your weekly ask and your invite link.' },
    { file: '04-meetings', title: 'Meetings and attendance', duration: '1:47', text: 'RSVP, join on Zoom, sign up to speak, upload slides, attendance.' },
    { file: '05-referrals', title: 'Giving a referral', duration: '1:03', text: 'Send a referral slip and update the ones you received.' },
    { file: '06-one-on-ones', title: 'One-on-ones', duration: '1:06', text: 'Accept requests, report a one-on-one and request one.' },
    { file: '07-closed-business', title: 'Closed business', duration: '0:39', text: 'Mark a referral you received as closed business.' },
    { file: '08-visitors-brought', title: 'Visitors you brought', duration: '0:41', text: 'Log a guest you brought to a meeting.' },
    { file: '09-invite-guest', title: 'Inviting a guest', duration: '0:49', text: 'Invite someone to an upcoming meeting.' },
    { file: '10-directory', title: 'Member Directory', duration: '0:45', text: 'Search members, download contacts, open a profile.' },
    { file: '11-events', title: 'Events', duration: '0:58', text: 'Post your own workshop, mixer or open house.' },
    { file: '12-gallery', title: 'Gallery', duration: '0:55', text: 'Browse photos and upload your own.' },
    { file: '13-my-profile', title: 'My profile', duration: '0:56', text: 'Edit your profile, email settings and My Presentations.' },
    { file: '14-support', title: 'Getting help', duration: '0:39', text: 'Who to contact and where to find quick answers.' },
  ],
} as const;

/**
 * Admin sections: the tabs on every admin page and the header's Admin dropdown (owner, 2026-10-30: Meeting slides
 * right after Overview).
 */
/**
 * The admin tabs, in the owner's order (2026-11-24), with the one-line description shown on the Overview's tab cards.
 * `superAdmin` tabs are only listed for, and only open to, the Super Admins (`profiles.is_owner`). "Guest Invites &
 * Applications" (owner, 2026-11-23) wasn't in the new list; it sits with the member tabs, just before Members.
 */
export const adminLinks = [
  { href: '/admin', label: 'Overview', blurb: 'What needs attention now, and where everything is.' },
  {
    href: '/admin/meetings',
    label: 'Meetings',
    blurb: 'Change dates, times and Zoom links, cancel or hide meetings, and manage the 5- and 10-minute presentation slots.',
  },
  { href: '/present/next', label: 'Meeting Slides', blurb: 'Open the next meeting’s slides, or customize them: order, timers and the presenters’ files.' },
  { href: '/admin/materials', label: 'Presentation Materials', blurb: 'Every file, video and website link presenters added, and how much storage they use.' },
  {
    href: '/admin/attendance',
    label: 'Attendance',
    blurb: 'Who came to each meeting, from Zoom or by hand, attendance correction requests and the absence limit.',
  },
  { href: '/admin/recap', label: 'Member Recap', blurb: 'Preview and send the after-meeting email to members and the day’s visitors.' },
  {
    href: '/admin/management-recap',
    label: 'Management Recap',
    blurb: 'Preview the attendance email the Management Team gets after each meeting, and switch it on or off.',
  },
  {
    href: '/admin/guests',
    label: 'Guest Invites & Applications',
    blurb: 'Applications, the visitor sign-in link, every guest from Zoom link to approval, onboarding and category seats.',
  },
  { href: '/admin/members', label: 'Members', blurb: 'Edit any member’s profile, phone, category, status, photo and logo, and what they filed.' },
  {
    href: '/admin/activity',
    label: 'Member Activity',
    blurb: 'Referral slips, one-on-ones, member events and directory downloads. Delete duplicates or mistakes.',
  },
  { href: '/admin/stats', label: 'Member Stats', blurb: 'Per-member counts for any period: one-on-ones, referrals, closed business and visitors.' },
  {
    href: '/admin/report-cards',
    label: 'Report Cards',
    blurb: 'A quarterly check-in sheet per member for coaching: attendance, one-on-ones, referrals and visitors against the group’s goals.',
  },
  { href: '/admin/champion', label: 'BARP Champion', blurb: 'The points ranking for each meeting’s champion. Confirm the pick or choose someone else.' },
  { href: '/admin/leadership', label: 'Management', blurb: 'Who is listed in the Management section of the About page and on the Management Team slide.' },
  { href: '/admin/gallery', label: 'Gallery', blurb: 'Reorder, recaption or remove the photos members upload.', superAdmin: true },
  { href: '/admin/history', label: 'Change History', blurb: 'Every change an admin made to someone else’s data, and the log of every email the site sent.' },
] as const satisfies readonly { href: string; label: string; blurb: string; superAdmin?: boolean }[];

export type AdminLink = (typeof adminLinks)[number];

/** The admin tabs this admin may open: Super Admins see every tab, other admins all but the Super Admin ones. */
export const adminLinksFor = (superAdmin: boolean): readonly AdminLink[] => adminLinks.filter((l) => superAdmin || !('superAdmin' in l && l.superAdmin));

/** Owner meeting 2026-10-30: the four membership steps, reworded by the group. */
export const howItWorks = [
  { title: 'Visit up to twice as a guest', text: 'Get invited by a member and attend up to two meetings, then submit your application.' },
  { title: 'Meet the Membership Committee', text: 'One-to-ones with three Membership Committee members.' },
  { title: 'Connect with members', text: 'Keep having one-to-ones with fellow members so they get to know, like and trust you.' },
  { title: 'Grow your business', text: 'Trusted relationships turn into referrals. Give them, receive them, and report them to track the group’s growth.' },
];

export const values = [
  { title: 'Real relationships', text: 'People do business with others they know, like and trust.' },
  { title: 'Shared growth', text: 'Members help each other grow their business by referral.' },
  { title: 'Accountability', text: 'We show up, follow through, and report activity to maintain momentum and visibility.' },
];

export const metrics = [
  { title: 'Referrals', text: 'Members share leads, introductions and opportunities. A referral is any warm connection that may help another business grow.' },
  {
    title: 'One-on-ones',
    text: "Friendly, focused meetings between members to learn how to refer each other's business, services, goals and ideal prospects, and to deepen relationships.",
  },
  { title: 'Closed business', text: "When a referral turns into closed business, it's counted. It shows how conversations have become real results." },
];

/** Shown on About only until admins add people to the Management list (Admin → Management). */
export const leadership = {
  name: 'Viv Kelvin',
  business: 'Vabrato Real Estate',
  photo: '/images/leadership.jpg',
  caption: 'Leading with heart and consistency since day one.',
};

/** Official meeting agenda (Procedures, effective October 19, 2026). Times are Pacific. */
export const meetingAgenda = [
  { time: '8:15', item: 'Open networking' },
  { time: '8:30', item: 'Meeting called to order' },
  { time: '8:31', item: 'Introduction of the Membership Committee' },
  { time: '8:32', item: 'Introduction of guests' },
  { time: '8:33', item: '60-second infomercials: referrals, one-to-ones, closed business, thank-yous, testimonials and leads' },
  { time: '9:00', item: 'Statistics' },
  { time: '9:05', item: '5-minute educational presentation' },
  { time: '9:10', item: '1 minute of questions for the 5-minute presentation' },
  { time: '9:11', item: '10-minute presentation' },
  { time: '9:21', item: '5 minutes of questions for the 10-minute presentation' },
  { time: '9:26', item: 'Announcements' },
  { time: '9:29', item: 'Thank you, visitors: we will contact you' },
  { time: '9:45', item: 'Adjourn' },
] as const;

export const visitTips = [
  'Come ready with a quick 60-second introduction: your name, your business, and who you help.',
  "If you've worked with anyone in the group before, feel free to share a quick thank-you.",
  "You'll hear two short presentations: a helpful tip, and a spotlight on a member's business.",
  "Bring any events or promos you'd like to share during the closing round.",
];

/** Visit page steps, aligned with the Home steps the group reworded (owner, 2026-11-01). */
export const joinSteps = [
  { title: 'Get invited', text: 'Through a member, or request an invite below.' },
  { title: 'Visit up to twice as a guest', text: 'Attend up to two meetings, then submit your application.' },
  { title: '3 one-on-ones', text: 'With three Membership Committee members, then the committee reviews your application.' },
  { title: 'Connect & grow', text: 'Keep having one-on-ones with your fellow referral partners and grow your business by referral.' },
];

/** Agreement terms from the Member Application Form. */
export const agreementTerms = [
  { title: 'Dues', text: 'Our networking group has no membership fees. We just ask you to adhere to our group rules.' },
  { title: 'Attendance', text: 'Attendance is expected at every meeting. Members are only allowed to miss 2 meetings in a 6-month period.' },
  {
    title: 'Understanding',
    text: "Failure to meet the above terms or the member expectations contained in the group's Procedures may be cause for removal from the group.",
  },
] as const;

/** Attendance policy (Bylaws / Procedures): absences allowed in a rolling period. */
export const attendancePolicy = { maxAbsences: 2, months: 6, substitutesCount: true } as const;

export const albums = [
  { value: 'meetings', label: 'Meetings' },
  { value: 'mixers', label: 'Mixers' },
  { value: 'spotlights', label: 'Spotlights' },
  { value: 'community', label: 'Community' },
] as const;

export const referralStatusLabels = {
  new: 'New',
  contacted: 'Contacted',
  meeting_set: 'Meeting set',
  closed_deal: 'Closed business',
  not_a_fit: 'Not a fit',
} as const;

/**
 * Member leaderboard columns (dashboard and slides). Owner meeting 2026-10-30: closed business is confidential, so it is
 * shown only as a group total, never next to names (admins still see who on Member stats).
 */
export const leaderboardMetrics = [
  { key: 'one_on_ones', label: 'One-on-ones' },
  { key: 'referrals', label: 'Referrals' },
  { key: 'visitors', label: 'Visitors brought' },
] as const;

/** The visitor sign-in page management shares in the Zoom chat (owner, 2026-10-30). */
export const visitorSignInPath = '/visitor-sign-in';

export const guestStatusLabels = {
  requested: 'Invited',
  visited: 'Visiting',
  applied: 'Applied',
  joined: 'Joined',
} as const;

/** Speaker slots: database values stay 'education' / 'presentation'. */
export const slotLabels = { education: '5-minute presentation', presentation: '10-minute presentation' } as const;
export const slotShort = { education: '5-minute', presentation: '10-minute' } as const;
/** What each speaker slot is for (owner's wording). */
export const slotTitles = { education: '5-Minute Member Education', presentation: '10-Minute Presentation' } as const;
export const slotDescriptions = {
  education: 'One member shares something they’ve learned — a helpful insight, tool, or business tip.',
  presentation: 'One member dives deeper into their business to teach the group how to refer them better.',
} as const;

/** "BARP Google Sheet" button on the directory (owner, 2026-10-23). Link as given by the owner. */
export const barpSheetUrl = 'https://docs.google.com/spreadsheets/d/12kjnHPKlKJUb8sxYQTpjfK0z9Ii7FgKE3US-5RgfNrI/edit?usp=sharing';

/** Support page (owner request, 2026-10-17). Position "Support Team" for all three; each photo links to their profile (owner, 2026-10-25). */
export const supportTeam = [
  { name: 'Cedrick Velasco', role: 'Support Team', photo: '/support/cedrick-velasco.webp', profile: '/members/cedrick-admin' },
  { name: 'Shermaine Benolirao', role: 'Support Team', photo: '/support/shermaine-benolirao.webp', profile: '/members/shermaine-admin' },
  { name: 'Rachanee Munar', role: 'Support Team', photo: '/support/rachanee-munar.webp', profile: '/members/rachanee-admin' },
] as const;

/** Support team introduction, shown under the team photos (owner's text, 2026-10-24). */
export const supportIntro = [
  'We’re happy to be part of the Bay Area Referral Partners community! As part of the team working alongside Viv Kelvin at Vabrato Real Estate, we help support the Bay Area Referral Partners website and ensure members can access and navigate it with ease.',
  'Our team assists with website-related concerns, including login difficulties, navigating the website, locating information, and troubleshooting basic technical issues.',
  'Our goal is to provide reliable website support, making it easier for members to access the information and resources available to them.',
  'We’re proud to play a part in keeping the Bay Area Referral Partners community connected, one click at a time!',
];

export const supportTopics = [
  { title: 'Logging in', text: 'First-time sign-in, forgotten passwords and email codes.' },
  { title: 'Your profile', text: 'Your photo, business details, website and weekly ask.' },
  { title: 'Reporting activity', text: 'Referral slips, dollar values and one-on-one reports or requests.' },
  { title: 'Meetings & events', text: 'The meeting schedule, Zoom links, speaker slots and member events.' },
  { title: 'Visiting & joining', text: 'Requesting a guest invite and the membership application.' },
  { title: 'Something not working', text: 'A page that looks wrong, an error message or a button that does nothing.' },
] as const;

export const supportFaq = [
  {
    q: 'How do I log in for the first time?',
    a: 'Go to Log in and choose “Forgot password”. Enter the email the group has for you and follow the link to set your password. If nothing arrives, check your spam folder or ask support.',
  },
  {
    q: 'How do I change my photo?',
    a: 'Log in, open My profile and choose “Change photo”. Your photo is shown on your directory card and profile. To take it off, choose “Remove photo”.',
  },
  {
    q: 'How do I report a referral or a one-on-one?',
    a: 'Log in and open Report Activity in the menu. Choose Referrals to file a referral slip, One-on-ones to report or request a one-on-one, or Closed Businesses to mark a referral as closed business or file closed business you forgot to report.',
  },
  { q: 'Where is the Zoom link?', a: 'Members find it on the Meetings page (“Open Zoom link”). It is shared with logged-in members only.' },
  {
    q: 'I’m not a member yet. How do I visit?',
    a: 'Use “Request an invite” at the top of any page. The Membership Committee will be in touch about the next meeting.',
  },
] as const;

/** "Vabrato Real Estate | Fedora Fiduciary": business name plus the optional second business (owner meeting 2026-10-30). */
export const businessLine = (p: { business_name: string; second_business_name?: string | null }) =>
  p.second_business_name ? `${p.business_name} | ${p.second_business_name}` : p.business_name;
