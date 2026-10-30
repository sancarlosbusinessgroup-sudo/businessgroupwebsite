import { describe, expect, it } from 'vitest';
import { calendarLinks, utcStamp } from './calendar-links';

const ev = {
  title: 'Bay Area Referral Partners: Networking',
  start: new Date('2026-11-09T16:15:00.000Z'),
  end: new Date('2026-11-09T17:30:00.000Z'),
  details: 'Members: join from https://example.org/meetings',
  location: 'Online · Zoom',
};

describe('calendarLinks', () => {
  it('stamps UTC without separators or milliseconds', () => {
    expect(utcStamp(ev.start)).toBe('20261109T161500Z');
  });

  it('offers Google, Outlook.com, Microsoft 365 and Yahoo in that order', () => {
    expect(calendarLinks(ev).map((l) => l.id)).toEqual(['google', 'outlook', 'office365', 'yahoo']);
  });

  it('Google link carries title, UTC dates, details and location', () => {
    const g = new URL(calendarLinks(ev)[0]!.href);
    expect(g.origin + g.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(g.searchParams.get('action')).toBe('TEMPLATE');
    expect(g.searchParams.get('text')).toBe(ev.title);
    expect(g.searchParams.get('dates')).toBe('20261109T161500Z/20261109T173000Z');
    expect(g.searchParams.get('details')).toBe(ev.details);
    expect(g.searchParams.get('location')).toBe(ev.location);
  });

  it('Outlook links use the compose deeplink on outlook.live.com and outlook.office.com', () => {
    const [, live, work] = calendarLinks(ev);
    for (const [link, host] of [
      [live!, 'outlook.live.com'],
      [work!, 'outlook.office.com'],
    ] as const) {
      const u = new URL(link.href);
      expect(u.host).toBe(host);
      expect(u.searchParams.get('subject')).toBe(ev.title);
      expect(u.searchParams.get('startdt')).toBe('2026-11-09T16:15:00Z');
      expect(u.searchParams.get('enddt')).toBe('2026-11-09T17:30:00Z');
      expect(u.searchParams.get('rru')).toBe('addevent');
    }
  });

  it('Yahoo link carries start and end', () => {
    const y = new URL(calendarLinks(ev)[3]!.href);
    expect(y.searchParams.get('st')).toBe('20261109T161500Z');
    expect(y.searchParams.get('et')).toBe('20261109T173000Z');
    expect(y.searchParams.get('title')).toBe(ev.title);
  });

  it('copes with no details or location', () => {
    const g = new URL(calendarLinks({ ...ev, details: null, location: undefined })[0]!.href);
    expect(g.searchParams.get('details')).toBe('');
    expect(g.searchParams.get('location')).toBe('');
  });
});
