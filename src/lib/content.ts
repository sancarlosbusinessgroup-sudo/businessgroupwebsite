// Site copy that rarely changes. Everything that members create lives in Supabase.

export const site = {
  name: 'Bay Area Referral Partners',
  shortName: 'Bay Area Referral Partners',
  timezone: 'America/Los_Angeles',
  founded: 2016,
  meetingCadence: 'Every other Monday',
  meetingTime: '8:15 AM',
  serviceArea:
    'San Carlos, Redwood City, Belmont, San Mateo, Foster City, Burlingame, Millbrae, Hillsborough, Menlo Park, Atherton, Palo Alto and surrounding communities',
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
    ],
  },
  { href: '/members', label: 'Directory' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/profile', label: 'My profile' },
  // Owner 2026-10-30: "Invite A Guest" sits right next to Support, even when the menu wraps.
  { href: '/invite-guest', label: 'Invite A Guest', keepWith: 'help' },
  { href: '/support', label: 'Support', keepWith: 'help' },
] as const;

export const howItWorks = [
  { title: 'Visit twice, no membership fees', text: 'Get invited by a member and attend up to two meetings as a guest.' },
  { title: 'Meet the Membership Committee', text: "One-to-ones with three Membership Committee members. If it's a fit, welcome aboard." },
  { title: 'Refer and connect', text: 'Share warm introductions and invite guests. Your referral link tracks every one.' },
  {
    title: 'We help you grow your business by referral',
    text: 'Report referrals, one-on-ones and closed business. The leaderboard shows the whole group’s progress.',
  },
];

export const values = [
  { title: 'Real relationships', text: 'We go beyond the pitch to build trust and friendships that lead to long-term partnerships.' },
  { title: 'Shared growth', text: 'Members refer each other and collaborate intentionally to create measurable business growth.' },
  { title: 'Accountability', text: 'We show up, follow through, and report activity to maintain momentum and visibility.' },
];

export const metrics = [
  { title: 'Referrals', text: 'Members share leads, introductions and opportunities. A referral is any warm connection that may help another business grow.' },
  { title: 'One-on-ones', text: "Friendly, focused meetings between two members to learn each other's services, goals and ideal customers." },
  { title: 'Closed business', text: "When a referral turns into paid work, it's counted. It shows how conversations become real results." },
];

export const timeline = [
  { year: '2016', text: 'Originally founded with the San Carlos Chamber of Commerce.' },
  { year: '2020', text: 'Chamber closes. Members choose to keep going and move to Zoom' },
  { year: 'Today', text: 'Meeting every other Monday, 8:15am–9:30am' },
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
  { time: '9:30', item: 'Adjourn' },
] as const;

export const visitTips = [
  'Come ready with a quick 60-second introduction: your name, your business, and who you help.',
  "If you've worked with anyone in the group before, feel free to share a quick thank-you.",
  "You'll hear two short presentations: a helpful tip, and a spotlight on a member's business.",
  "Bring any events or promos you'd like to share during the closing round.",
];

export const joinSteps = [
  { title: 'Get invited', text: 'Through a member, or request an invite below.' },
  { title: 'Attend as a guest', text: 'Up to two meetings. No membership fees.' },
  { title: '3 one-on-ones', text: 'With three Membership Committee members, then the committee reviews your application.' },
  { title: 'Join & grow', text: 'Mutual fit? Welcome aboard.' },
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

export const leaderboardMetrics = [
  { key: 'one_on_ones', label: 'One-on-ones' },
  { key: 'referrals', label: 'Referrals' },
  { key: 'closed_deals', label: 'Closed business' },
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
    a: 'Use “Request for an Invite” at the top of any page. The Membership Committee will be in touch about the next meeting.',
  },
] as const;
