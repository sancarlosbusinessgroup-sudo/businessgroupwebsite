// Transactional email content. Pure functions (no I/O) so they are unit-tested.
// Each returns a subject plus HTML and plain-text bodies in the site's look (logo, brand colours).

import { site, slotTitles } from '../content';

export type Email = { subject: string; html: string; text: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Link = [label: string, href: string];
type Item = { eyebrow: string; title: string; lines: string[]; links?: Link[] };
type Block = { p: string } | { list: [string, string][] } | { quote: string } | { h: string } | { links: Link[] } | { item: Item } | { button: Link };

const linkHtml = ([label, href]: Link) => `<a href="${esc(href)}" style="color:#0c7b74;font-weight:700">${esc(label)}</a>`;
const linksHtml = (ls: Link[]) => ls.map(linkHtml).join(' &nbsp;·&nbsp; ');
const linksText = (ls: Link[]) => ls.map(([l, h]) => `${l}: ${h}`).join('\n');

/** Shared layout: logo header, white card, one call-to-action button, footer with the "why you got this" line. */
export function layout(o: { siteUrl: string; preheader: string; heading: string; blocks: Block[]; cta?: { label: string; href: string }; footer: string }): {
  html: string;
  text: string;
} {
  const body = o.blocks
    .map((b) => {
      if ('p' in b) return `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#1c2e2e">${esc(b.p)}</p>`;
      if ('quote' in b)
        return `<p style="margin:0 0 14px;padding:12px 14px;border-left:4px solid #12a89d;background:#effbfc;font-size:15px;line-height:1.5;color:#1c2e2e">${esc(b.quote)}</p>`;
      if ('h' in b) return `<h2 style="margin:24px 0 10px;font-size:19px;line-height:1.3;color:#0c7b74">${esc(b.h)}</h2>`;
      if ('links' in b) return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1c2e2e">${linksHtml(b.links)}</p>`;
      if ('button' in b)
        return `<p style="margin:4px 0 16px"><a href="${esc(b.button[1])}" style="display:inline-block;background:#0c7b74;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:10px 20px;border-radius:999px">${esc(b.button[0])}</a></p>`;
      if ('item' in b)
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;width:100%;border-collapse:collapse"><tr><td style="border-left:4px solid #12a89d;padding:4px 0 4px 14px;font-size:15px;line-height:1.55;color:#1c2e2e"><p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#4f6464">${esc(b.item.eyebrow)}</p><p style="margin:2px 0 4px;font-size:17px;font-weight:700;color:#0b3b3b">${esc(b.item.title)}</p>${b.item.lines
          .map((l) => `<p style="margin:0 0 4px">${esc(l)}</p>`)
          .join('')}${b.item.links?.length ? `<p style="margin:4px 0 0">${linksHtml(b.item.links)}</p>` : ''}</td></tr></table>`;
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;width:100%;border-collapse:collapse">${b.list
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px 6px 0;font-size:14px;color:#4f6464;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-size:15px;color:#1c2e2e">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`;
    })
    .join('');
  const button = o.cta
    ? `<p style="margin:22px 0 6px"><a href="${esc(o.cta.href)}" style="display:inline-block;background:#0c7b74;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:12px 22px;border-radius:999px">${esc(o.cta.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.heading)}</title></head>
<body style="margin:0;padding:0;background:#f1fbfb;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(o.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1fbfb"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 16px"><a href="${esc(o.siteUrl)}" style="text-decoration:none;color:#0b3b3b;font-weight:700;font-size:18px"><img src="${esc(o.siteUrl)}/images/logo-mark.png" width="40" height="40" alt="" style="vertical-align:middle;border:0;margin-right:8px">${esc(site.name)}</a></td></tr>
<tr><td style="background:#ffffff;border-top:4px solid #00c2cb;border-radius:12px;padding:26px 24px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#0b3b3b">${esc(o.heading)}</h1>${body}${button}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#4f6464">${esc(o.footer)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    o.heading,
    '',
    ...o.blocks.map((b) =>
      'p' in b
        ? b.p
        : 'quote' in b
          ? `"${b.quote}"`
          : 'h' in b
            ? `\n${b.h.toUpperCase()}`
            : 'links' in b
              ? linksText(b.links)
              : 'button' in b
                ? linksText([b.button])
                : 'item' in b
                  ? [`${b.item.eyebrow}: ${b.item.title}`, ...b.item.lines, ...(b.item.links ? [linksText(b.item.links)] : [])].join('\n')
                  : b.list.map(([k, v]) => `${k}: ${v}`).join('\n'),
    ),
    ...(o.cta ? ['', `${o.cta.label}: ${o.cta.href}`] : []),
    '',
    '—',
    o.footer,
  ].join('\n');
  return { html, text };
}

const prefsFooter = (siteUrl: string) =>
  `You get this email as a member of ${site.name}. Change which emails you receive in My profile: ${siteUrl}/profile?tab=edit#email`;
const accountFooter = `You get this email because of your ${site.name} account.`;

export function welcomeEmail(o: { siteUrl: string; firstName: string }): Email {
  const subject = `Welcome to ${site.name}, ${o.firstName}!`;
  return {
    subject,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'You’re approved. One short step left: your onboarding form.',
      heading: `Welcome aboard, ${o.firstName}!`,
      blocks: [
        { p: `The leadership team has approved your membership in ${site.name}. We’re glad to have you.` },
        { p: 'Please complete your short onboarding form: confirm your details, add a photo and tell members how to refer you. It takes about five minutes.' },
        { p: `Log in with the email and password you used to apply. Forgot your password? Use “Forgot password” on the login page.` },
      ],
      cta: { label: 'Complete my onboarding', href: `${o.siteUrl}/onboarding` },
      footer: accountFooter,
    }),
  };
}

export function onboardingReminderEmail(o: { siteUrl: string; firstName: string }): Email {
  return {
    subject: 'Reminder: finish your onboarding',
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'Your member profile helps everyone refer you.',
      heading: `${o.firstName}, your onboarding is almost done`,
      blocks: [{ p: 'Your profile is how members learn who to send your way. Please take five minutes to finish your onboarding form.' }],
      cta: { label: 'Finish onboarding', href: `${o.siteUrl}/onboarding` },
      footer: accountFooter,
    }),
  };
}

export function referralReceivedEmail(o: {
  siteUrl: string;
  toFirstName: string;
  fromName: string;
  prospect: string;
  phone?: string | null;
  email?: string | null;
  amount?: string | null;
  notes?: string | null;
}): Email {
  const list: [string, string][] = [['Prospect', o.prospect]];
  if (o.phone) list.push(['Phone', o.phone]);
  if (o.email) list.push(['Email', o.email]);
  if (o.amount) list.push(['Estimated value', o.amount]);
  return {
    subject: `New referral from ${o.fromName}: ${o.prospect}`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: `${o.fromName} passed you a referral.`,
      heading: `You have a new referral, ${o.toFirstName}`,
      blocks: [
        { p: `${o.fromName} filed a referral slip for you.` },
        { list },
        ...(o.notes ? [{ quote: o.notes }] : []),
        { p: 'Reach out soon, then update the status so they know how it went.' },
      ],
      cta: { label: 'Open my referrals', href: `${o.siteUrl}/referrals` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function referralStatusEmail(o: {
  siteUrl: string;
  toFirstName: string;
  receiverName: string;
  prospect: string;
  status: string;
  amount?: string | null;
}): Email {
  return {
    subject: `Referral update: ${o.prospect} is now “${o.status}”`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: `${o.receiverName} updated your referral.`,
      heading: `Your referral was updated, ${o.toFirstName}`,
      blocks: [
        { p: `${o.receiverName} updated the referral you gave them.` },
        { list: [['Prospect', o.prospect], ['Status', o.status], ...(o.amount ? ([['Value', o.amount]] as [string, string][]) : [])] },
        ...(o.status === 'Closed business' ? [{ p: 'Congratulations: your referral turned into business!' }] : []),
      ],
      cta: { label: 'See my referrals', href: `${o.siteUrl}/referrals` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function oneOnOneConfirmEmail(o: { siteUrl: string; toFirstName: string; reporterName: string; date: string }): Email {
  return {
    subject: `Please confirm your one-on-one with ${o.reporterName}`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'One click to confirm.',
      heading: `Confirm your one-on-one, ${o.toFirstName}`,
      blocks: [{ p: `${o.reporterName} reported a one-on-one with you on ${o.date}. Please confirm it so it counts for both of you.` }],
      cta: { label: 'Confirm it', href: `${o.siteUrl}/one-on-ones` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function oneOnOneRequestEmail(o: {
  siteUrl: string;
  toFirstName: string;
  requesterName: string;
  business: string;
  date?: string | null;
  message?: string | null;
}): Email {
  return {
    subject: `${o.requesterName} would like a one-on-one`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'Accept or decline on your One-on-ones page.',
      heading: `${o.requesterName} would like to meet, ${o.toFirstName}`,
      blocks: [
        { p: `${o.requesterName} (${o.business}) asked for a one-on-one with you${o.date ? ` and suggested ${o.date}` : ''}.` },
        ...(o.message ? [{ quote: o.message }] : []),
      ],
      cta: { label: 'Accept or decline', href: `${o.siteUrl}/one-on-ones` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function oneOnOneAnswerEmail(o: { siteUrl: string; toFirstName: string; inviteeName: string; accepted: boolean }): Email {
  return {
    subject: o.accepted ? `${o.inviteeName} accepted your one-on-one request` : `${o.inviteeName} declined your one-on-one request`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: o.accepted ? 'Time to set a date.' : 'Maybe another time.',
      heading: o.accepted ? 'Your one-on-one is on' : 'One-on-one request declined',
      blocks: [
        {
          p: o.accepted
            ? `${o.inviteeName} accepted your request, ${o.toFirstName}. Reach out to set a time, then report it on the One-on-ones page once you’ve met.`
            : `${o.inviteeName} can’t meet right now, ${o.toFirstName}. There are plenty of other members to get to know.`,
        },
      ],
      cta: { label: 'Open One-on-ones', href: `${o.siteUrl}/one-on-ones` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function guestThanksEmail(o: { siteUrl: string; firstName: string; meeting?: string | null }): Email {
  return {
    subject: `Thanks for your interest in ${site.name}`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'We’ve got your request.',
      heading: `Thanks, ${o.firstName}!`,
      blocks: [
        {
          p: `We’ve received your request to visit ${site.name}${o.meeting ? ` on ${o.meeting}` : ''}. A member of our team will send you the Zoom link before the meeting.`,
        },
        {
          p: `We meet ${site.meetingCadence.toLowerCase()} at ${site.meetingTime} PT. Come ready with a 60-second introduction: your name, your business and who you help.`,
        },
      ],
      cta: { label: 'What to expect', href: `${o.siteUrl}/visit` },
      footer: `You get this email because you asked to visit ${site.name}.`,
    }),
  };
}

export function guestNoticeEmail(o: {
  siteUrl: string;
  toFirstName: string;
  forAdmins: boolean;
  guestName: string;
  guestEmail: string;
  business?: string | null;
  invitedBy?: string | null;
  meeting?: string | null;
}): Email {
  const list: [string, string][] = [
    ['Name', o.guestName],
    ['Email', o.guestEmail],
  ];
  if (o.business) list.push(['Business', o.business]);
  if (o.invitedBy) list.push(['Invited by', o.invitedBy]);
  if (o.meeting) list.push(['Meeting', o.meeting]);
  return {
    subject: o.forAdmins ? `New guest request: ${o.guestName}` : `Your guest ${o.guestName} asked to visit`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: o.forAdmins ? 'Send them the Zoom link.' : 'Say hello before the meeting.',
      heading: o.forAdmins ? 'New guest request' : `Your guest is coming, ${o.toFirstName}`,
      blocks: [
        {
          p: o.forAdmins
            ? 'Someone asked to visit a meeting. Please send them the Zoom link and mark them “Visited” on the Admin page after the meeting.'
            : `${o.guestName} used your invite to request a visit. A quick hello before the meeting goes a long way.`,
        },
        { list },
      ],
      cta: o.forAdmins ? { label: 'Open Admin', href: `${o.siteUrl}/admin` } : { label: 'See my guests', href: `${o.siteUrl}/dashboard#invite` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function meetingReminderEmail(o: {
  siteUrl: string;
  firstName: string;
  when: string;
  title: string;
  joinUrl?: string | null;
  five?: string | null;
  ten?: string | null;
}): Email {
  const list: [string, string][] = [['When', o.when]];
  list.push([slotTitles.education, o.five ?? 'Open']);
  list.push([slotTitles.presentation, o.ten ?? 'Open']);
  return {
    subject: `Today: ${o.title}`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: `See you at ${o.when}.`,
      heading: `See you this morning, ${o.firstName}`,
      blocks: [
        { list },
        {
          p: 'Have your 60-second infomercial ready: referrals, one-to-ones, closed business, thank-yous, testimonials and leads. Open networking starts at 8:15 AM; we call the meeting to order at 8:30 AM sharp.',
        },
        ...(o.joinUrl ? [{ p: `Zoom link: ${o.joinUrl}` }] : []),
      ],
      cta: o.joinUrl ? { label: 'Join on Zoom', href: o.joinUrl } : { label: 'Open Meetings', href: `${o.siteUrl}/meetings` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function visitorFollowupEmail(o: { siteUrl: string; firstName: string }): Email {
  return {
    subject: `Thanks for visiting ${site.name}`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'We hope you enjoyed the meeting.',
      heading: `Thanks for joining us, ${o.firstName}!`,
      blocks: [
        { p: 'It was great to have you at our meeting. We keep one member per profession, so every introduction counts.' },
        { p: 'If it felt like a good fit, the next step is a short application. The leadership team will be in touch about one-to-ones.' },
      ],
      cta: { label: 'Apply to join', href: `${o.siteUrl}/join` },
      footer: `You get this email because you visited ${site.name}.`,
    }),
  };
}

export function memberFollowupEmail(o: { siteUrl: string; toFirstName: string; guests: string[] }): Email {
  return {
    subject: o.guests.length === 1 ? `Follow up with your guest ${o.guests[0]}` : `Follow up with your ${o.guests.length} guests`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'A quick thank-you keeps the momentum going.',
      heading: `Thanks for bringing visitors, ${o.toFirstName}`,
      blocks: [
        { p: `Your guest${o.guests.length === 1 ? '' : 's'} visited yesterday: ${o.guests.join(', ')}.` },
        { p: 'A quick thank-you call or note today goes a long way, and you can share the application link if it felt like a fit.' },
      ],
      cta: { label: 'See my guests', href: `${o.siteUrl}/dashboard#invite` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function adminDigestEmail(o: {
  siteUrl: string;
  firstName: string;
  week: string;
  pending: number;
  guests: number;
  referrals: number;
  oneOnOnes: number;
  closedDeals: number;
  closedAmount: string;
  nextMeeting?: string | null;
  openSlots?: string | null;
}): Email {
  return {
    subject: `Weekly digest: ${o.week}`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: `${o.referrals} referrals, ${o.oneOnOnes} one-on-ones, ${o.pending} pending applicants.`,
      heading: `This week at ${site.name}`,
      blocks: [
        {
          list: [
            ['Pending applicants', String(o.pending)],
            ['New guest requests', String(o.guests)],
            ['Referrals filed', String(o.referrals)],
            ['One-on-ones confirmed', String(o.oneOnOnes)],
            ['Closed business', `${o.closedDeals} (${o.closedAmount})`],
            ...(o.nextMeeting ? ([['Next meeting', o.nextMeeting]] as [string, string][]) : []),
            ...(o.openSlots ? ([['Open speaker slots', o.openSlots]] as [string, string][]) : []),
          ],
        },
      ],
      cta: { label: 'Open Admin', href: `${o.siteUrl}/admin` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

export function applyInviteEmail(o: { siteUrl: string; firstName: string; link: string }): Email {
  return {
    subject: `You're invited to apply to ${site.name}`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'Your membership application form is ready.',
      heading: `${o.firstName}, you're invited to apply`,
      blocks: [
        { p: `Thank you for visiting ${site.name}. The leadership team would love to have you apply for membership.` },
        {
          p: 'The membership application form takes about 10 minutes. You will need two business references, and you will be asked to agree to our terms, so please read the Bylaws and Procedures first.',
        },
        { p: 'Next, you will have one-to-ones with three members of our leadership team, who then review your application.' },
      ],
      cta: { label: 'Open the membership form', href: o.link },
      footer: `You get this email because you visited ${site.name}.`,
    }),
  };
}

export type RecapTalk = { name: string; business?: string | null; topic?: string | null; description?: string | null; video?: string | null };
export type RecapEvent = { when: string; title: string; href: string; where?: string | null };

/** Sent to every member after a meeting ends: slides, presenters, member events and who's up next. */
export function meetingRecapEmail(o: {
  siteUrl: string;
  firstName: string;
  meetingTitle: string;
  slidesHref: string;
  five?: RecapTalk | null;
  ten?: RecapTalk | null;
  events: RecapEvent[];
  next?: { when: string; five?: string | null; ten?: string | null } | null;
}): Email {
  const talk = (eyebrow: string, t: RecapTalk): Block => ({
    item: {
      eyebrow,
      title: t.topic || `Presented by ${t.name}`,
      lines: [[t.name, t.business].filter(Boolean).join(', '), ...(t.description ? [t.description] : [])],
      links: t.video ? [['Watch the video', t.video]] : undefined,
    },
  });
  const blocks: Block[] = [
    {
      p: 'Thanks for showing up this morning. Every introduction, one-on-one and referral you passed today is the engine behind this group: when one of us grows, we all get more to work with.',
    },
    { h: 'Log today’s activity while it’s fresh' },
    {
      p: 'Passed a referral or had a one-on-one? Record it on the site. It takes under a minute, and it feeds the leaderboard and group totals we show at each meeting.',
    },
    { button: ['Open my dashboard', `${o.siteUrl}/dashboard`] },
    {
      links: [
        ['Report a referral', `${o.siteUrl}/referrals`],
        ['Report a one-on-one', `${o.siteUrl}/one-on-ones`],
        ['Help & how-to', `${o.siteUrl}/support`],
      ],
    },
    { h: 'Today’s meeting' },
    { p: 'Missed something or want another look? The slides are on the site. Presenters’ materials often include extra links and offers.' },
    { links: [['View today’s slides', o.slidesHref]] },
  ];
  if (o.five) blocks.push(talk(slotTitles.education, o.five));
  if (o.ten) blocks.push(talk(slotTitles.presentation, o.ten));
  blocks.push({ h: 'Show up for each other' });
  blocks.push({ p: 'Member events are one of the easiest ways to give back to the group. Pop in, bring a guest, or put your own event on the calendar.' });
  for (const e of o.events) blocks.push({ item: { eyebrow: e.when, title: e.title, lines: e.where ? [e.where] : [], links: [['Details', e.href]] } });
  if (!o.events.length) blocks.push({ p: 'No member events are on the calendar for the next two weeks yet.' });
  blocks.push({
    links: [
      ['See all member events', `${o.siteUrl}/events`],
      ['Post your own event', `${o.siteUrl}/events/new`],
    ],
  });
  blocks.push({ h: 'Is your profile pulling its weight?' });
  blocks.push({ p: 'Your profile is how members know who to send your way. Keep your services, ideal client, photo and this week’s ask up to date.' });
  blocks.push({ links: [['Update my profile', `${o.siteUrl}/profile?tab=edit`]] });
  if (o.next) {
    blocks.push({ h: 'Next meeting' });
    blocks.push({
      list: [
        ['When', `${o.next.when} PT, on Zoom`],
        [slotTitles.education, o.next.five ?? 'Open'],
        [slotTitles.presentation, o.next.ten ?? 'Open'],
      ],
    });
    blocks.push({ p: 'Your Zoom link comes in the meeting-day reminder that morning.' });
  }
  blocks.push({ p: 'Go make it a great week. See you next meeting!' });
  const open = o.next && (!o.next.five || !o.next.ten);
  return {
    subject: `Meeting recap: ${o.meetingTitle}`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: 'Slides, presenters, member events and who’s up next. Plus: log your referrals while they’re fresh.',
      heading: `Thanks for coming, ${o.firstName}!`,
      blocks,
      cta: open ? { label: 'Claim a presentation slot', href: `${o.siteUrl}/meetings` } : { label: 'Open Meetings', href: `${o.siteUrl}/meetings` },
      footer: prefsFooter(o.siteUrl),
    }),
  };
}

/** To admins when a member deletes their own account (owner, 2026-10-23). */
export function accountDeletedEmail(o: { siteUrl: string; toFirstName: string; name: string; business: string }): Email {
  return {
    subject: `${o.name} deleted their member account`,
    ...layout({
      siteUrl: o.siteUrl,
      preheader: `${o.name} (${o.business}) is no longer a member on the website.`,
      heading: `${o.name} deleted their account`,
      blocks: [
        { p: `Hi ${o.toFirstName}, ${o.name} (${o.business}) deleted their account on the website today. Their profile, photo and contact details are gone.` },
        {
          p: 'Referral slips and one-on-ones they shared with other members are kept and now show as "Former member". If they were on the Management list or held a presentation slot, please update those.',
        },
      ],
      cta: { label: 'Open Admin', href: `${o.siteUrl}/admin` },
      footer: accountFooter,
    }),
  };
}
