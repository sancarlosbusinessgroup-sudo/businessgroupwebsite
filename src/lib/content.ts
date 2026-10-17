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
  credit: 'Artwork and images contributed by Vabrato Real Estate & Upendo Ventures',
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

export const memberNav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/referrals', label: 'Referrals' },
  { href: '/one-on-ones', label: 'One-on-ones' },
  { href: '/members', label: 'Directory' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/profile', label: 'My profile' },
] as const;

export const howItWorks = [
  { title: 'Visit twice, free', text: 'Get invited by a member and attend up to two meetings as a guest.' },
  { title: 'Meet the committee', text: "Three one-on-ones with membership committee members. If it's a fit, welcome aboard." },
  { title: 'Refer and connect', text: 'Share warm introductions and invite guests. Your referral link tracks every one.' },
  { title: 'Watch it grow', text: 'Report referrals, one-on-ones and closed deals. The leaderboard shows the whole group’s progress.' },
];

export const values = [
  { title: 'Real relationships', text: 'We go beyond the pitch to build trust and friendships that lead to long-term partnerships.' },
  { title: 'Shared growth', text: 'Members refer each other and collaborate intentionally to create measurable business growth.' },
  { title: 'Accountability', text: 'We show up, follow through, and report activity to maintain momentum and visibility.' },
];

export const metrics = [
  { title: 'Referrals', text: 'Members share leads, introductions and opportunities. A referral is any warm connection that may help another business grow.' },
  { title: 'One-on-ones', text: "Friendly, focused meetings between two members to learn each other's services, goals and ideal customers." },
  { title: 'Closed deals', text: "When a referral turns into paid work, it's counted. It shows how conversations become real results." },
];

export const timeline = [
  { year: '2016', text: 'Founded within the San Carlos Chamber of Commerce' },
  { year: '2020', text: 'Chamber closes. Members choose to keep going and move to Zoom' },
  { year: 'Today', text: 'Meeting every other Monday, online with hybrid gatherings' },
];

/** Shown on About only until admins add people to the Management list (Admin → Management). */
export const leadership = {
  name: 'Viv Kelvin',
  business: 'Vabrato Real Estate',
  photo: '/images/leadership.jpg',
  caption: 'Leading with heart and consistency since day one.',
};

/** Official meeting agenda (Procedures, effective Jan 1, 2026). Times are Pacific. */
export const meetingAgenda = [
  { time: '8:15', item: 'Open networking' },
  { time: '8:30', item: 'Meeting called to order' },
  { time: '8:31', item: 'Introduction of the leadership team' },
  { time: '8:32', item: '30-second infomercial' },
  { time: '8:42', item: 'Introduction of guests' },
  { time: '8:45', item: 'Statistics' },
  { time: '8:50', item: '30-second referrals, leads, testimonials and thank-yous' },
  { time: '9:05', item: '5-minute educational presentation' },
  { time: '9:10', item: '10-minute presentation' },
  { time: '9:20', item: '5 minutes of questions for the 10-minute presentation' },
  { time: '9:25', item: 'Announcements' },
  { time: '9:28', item: 'Thank you, visitors: we will contact you' },
  { time: '9:30', item: 'Adjourn' },
] as const;

export const visitTips = [
  'Come ready with a quick 30-second introduction: your name, your business, and who you help.',
  "If you've worked with anyone in the group before, feel free to share a quick thank-you.",
  "You'll hear two short presentations: a helpful tip, and a spotlight on a member's business.",
  "Bring any events or promos you'd like to share during the closing round.",
];

export const joinSteps = [
  { title: 'Get invited', text: 'Through a member, or request an invite below.' },
  { title: 'Attend as a guest', text: 'Up to two meetings, free.' },
  { title: '3 one-on-ones', text: 'With three leadership team members, then the team reviews your application.' },
  { title: 'Join & grow', text: 'Mutual fit? Welcome aboard.' },
];

/** Agreement terms from the Member Application Form. */
export const agreementTerms = [
  { title: 'Dues', text: 'Our networking group is free. We just ask you to adhere to our group rules.' },
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
  closed_deal: 'Closed deal',
  not_a_fit: 'Not a fit',
} as const;

export const leaderboardMetrics = [
  { key: 'one_on_ones', label: 'One-on-ones' },
  { key: 'referrals', label: 'Referrals' },
  { key: 'closed_deals', label: 'Closed deals' },
  { key: 'visitors', label: 'Visitors brought' },
] as const;

export const guestStatusLabels = {
  requested: 'Invited',
  visited: 'Visiting',
  applied: 'Applied',
  joined: 'Joined',
} as const;

/** Speaker slots: database values stay 'education' / 'presentation'. */
export const slotLabels = { education: '5-minute presentation', presentation: '10-minute presentation' } as const;
export const slotShort = { education: '5-minute', presentation: '10-minute' } as const;
