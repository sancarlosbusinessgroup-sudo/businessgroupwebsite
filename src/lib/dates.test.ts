import { describe, expect, it } from 'vitest';
import { countdownParts, formatMeetingDate, formatMeetingTime, inCheckInWindow, monthGrid, isoToPacificLocal, pacificLocalToIso } from './dates';

describe('countdownParts', () => {
  it('splits the remaining time into days/hours/minutes/seconds', () => {
    const now = new Date('2026-10-14T00:00:00Z');
    const target = new Date('2026-10-15T01:02:03Z');
    expect(countdownParts(target, now)).toEqual({ days: 1, hours: 1, minutes: 2, seconds: 3, done: false });
  });

  it('never goes negative and reports done once the target passes', () => {
    const now = new Date('2026-10-16T00:00:00Z');
    expect(countdownParts(new Date('2026-10-15T00:00:00Z'), now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      done: true,
    });
  });
});

describe('formatting in Pacific time', () => {
  it('formats a meeting start in the group timezone regardless of viewer timezone', () => {
    const d = new Date('2026-10-26T15:15:00Z'); // 8:15 AM PDT
    expect(formatMeetingTime(d)).toBe('8:15 AM');
    expect(formatMeetingDate(d)).toBe('Monday, Oct 26');
  });
});

describe('inCheckInWindow', () => {
  const start = new Date('2026-10-26T15:15:00Z');
  const end = new Date('2026-10-26T16:30:00Z');
  it('opens 15 minutes before the start and closes at the end', () => {
    expect(inCheckInWindow(start, end, new Date('2026-10-26T14:59:00Z'))).toBe(false);
    expect(inCheckInWindow(start, end, new Date('2026-10-26T15:01:00Z'))).toBe(true);
    expect(inCheckInWindow(start, end, new Date('2026-10-26T16:31:00Z'))).toBe(false);
  });
});

describe('monthGrid', () => {
  it('pads the first week and covers every day of the month', () => {
    const cells = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(cells.slice(0, 4).every((c) => c === null)).toBe(true);
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
    expect(cells[4]).toEqual({ year: 2026, month: 9, day: 1 });
  });
});

describe('Pacific wall-clock times for event forms', () => {
  it('converts a Pacific date + time to UTC across daylight saving', () => {
    expect(pacificLocalToIso('2026-10-20T18:00')).toBe('2026-10-21T01:00:00.000Z'); // PDT, UTC-7
    expect(pacificLocalToIso('2026-12-01T09:30')).toBe('2026-12-01T17:30:00.000Z'); // PST, UTC-8
  });
  it('returns null for malformed input', () => {
    expect(pacificLocalToIso('2026-13-01T09:30')).toBeNull();
    expect(pacificLocalToIso('tomorrow')).toBeNull();
  });
  it('round-trips back to the form value', () => {
    expect(isoToPacificLocal('2026-10-21T01:00:00.000Z')).toBe('2026-10-20T18:00');
    expect(isoToPacificLocal('2026-12-01T17:30:00Z')).toBe('2026-12-01T09:30');
  });
});
