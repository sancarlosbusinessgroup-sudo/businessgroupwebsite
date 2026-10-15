import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';

describe('buildIcs', () => {
  it('produces a valid calendar with escaped text and UTC times', () => {
    const ics = buildIcs(
      [
        {
          uid: 'abc',
          title: 'Meeting; with, commas',
          description: 'Line one\nLine two',
          location: 'Online · Zoom',
          start: new Date('2026-10-26T15:15:00Z'),
          end: new Date('2026-10-26T16:30:00Z'),
          url: 'https://example.org/events/x',
        },
      ],
      'Test calendar',
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261026T151500Z');
    expect(ics).toContain('SUMMARY:Meeting\\; with\\, commas');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });
});
