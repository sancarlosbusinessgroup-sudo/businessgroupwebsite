/**
 * "Add to calendar" links for one event: Google, Outlook.com, Microsoft 365 (work/school Outlook), Yahoo, plus the
 * site's own .ics file (Apple Calendar and anything else). Pure, so it is unit-tested; no Zoom links go in here (those
 * stay members-only, like the .ics).
 */
export type CalendarEventInput = {
  title: string;
  start: Date;
  end: Date;
  details?: string | null;
  location?: string | null;
};

export type CalendarLink = { id: 'google' | 'outlook' | 'office365' | 'yahoo'; label: string; href: string };

/** 20261102T161500Z */
export const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** 2026-11-02T16:15:00Z (what Outlook's compose link expects) */
const isoNoMs = (d: Date) => d.toISOString().replace(/\.\d{3}/, '');

export function calendarLinks(e: CalendarEventInput): CalendarLink[] {
  const details = e.details ?? '';
  const location = e.location ?? '';

  const google = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${utcStamp(e.start)}/${utcStamp(e.end)}`,
    details,
    location,
  });

  const outlook = (host: string) => {
    const q = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: e.title,
      startdt: isoNoMs(e.start),
      enddt: isoNoMs(e.end),
      body: details,
      location,
    });
    return `https://${host}/calendar/0/deeplink/compose?${q.toString()}`;
  };

  const yahoo = new URLSearchParams({
    v: '60',
    title: e.title,
    st: utcStamp(e.start),
    et: utcStamp(e.end),
    desc: details,
    in_loc: location,
  });

  return [
    { id: 'google', label: 'Google Calendar', href: `https://calendar.google.com/calendar/render?${google.toString()}` },
    { id: 'outlook', label: 'Outlook.com', href: outlook('outlook.live.com') },
    { id: 'office365', label: 'Microsoft 365 (work Outlook)', href: outlook('outlook.office.com') },
    { id: 'yahoo', label: 'Yahoo Calendar', href: `https://calendar.yahoo.com/?${yahoo.toString()}` },
  ];
}

/**
 * Title, description and place for a meeting or member event, the same as its .ics file: group meetings say where
 * members join (the Zoom link itself stays members-only); online member events give their link.
 */
export function calendarEventFor(
  m: {
    title: string;
    starts_at: string;
    ends_at: string;
    description: string | null;
    is_online: boolean;
    location: string | null;
    kind: 'group' | 'member';
    onlineUrl?: string | null;
    hostName?: string | null;
    cancelledReason?: string | null;
  },
  siteUrl: string,
) {
  const details =
    m.kind === 'group'
      ? [m.description, `Members: join from ${siteUrl}/meetings`].filter(Boolean).join('\n\n')
      : [m.hostName ? `Member event hosted by ${m.hostName}` : null, m.description].filter(Boolean).join('\n\n');
  const location = m.is_online ? (m.kind === 'member' && m.onlineUrl ? m.onlineUrl : (m.location ?? 'Online · Zoom')) : m.location;
  return {
    title: m.cancelledReason ? `Cancelled: ${m.title}` : m.title,
    starts_at: m.starts_at,
    ends_at: m.ends_at,
    details,
    location,
  };
}
