import { describe, expect, it } from 'vitest';
import { PERIODS, periodLabel, periodRange } from './periods';

// 2026-10-14 is a Wednesday. 20:00 UTC = 1 PM Pacific (same calendar day).
const now = new Date('2026-10-14T20:00:00Z');

describe('periodRange (Pacific calendar dates, end exclusive)', () => {
  it('week runs Monday to the next Monday', () => {
    expect(periodRange({ period: 'week' }, now)).toEqual({ from: '2026-10-12', to: '2026-10-19' });
  });

  it('meeting cycle starts on the last group meeting date and runs through today', () => {
    expect(periodRange({ period: 'cycle', lastMeeting: '2026-10-12' }, now)).toEqual({ from: '2026-10-12', to: '2026-10-15' });
  });

  it('meeting cycle falls back to the week when there is no past meeting', () => {
    expect(periodRange({ period: 'cycle', lastMeeting: null }, now)).toEqual({ from: '2026-10-12', to: '2026-10-19' });
  });

  it('month, quarter and year', () => {
    expect(periodRange({ period: 'month' }, now)).toEqual({ from: '2026-10-01', to: '2026-11-01' });
    expect(periodRange({ period: 'quarter' }, now)).toEqual({ from: '2026-10-01', to: '2027-01-01' });
    expect(periodRange({ period: 'year' }, now)).toEqual({ from: '2026-01-01', to: '2027-01-01' });
  });

  it('uses the Pacific date, not the UTC date, late in the evening', () => {
    // 2026-11-01 04:00 UTC is still Oct 31 in California.
    expect(periodRange({ period: 'month' }, new Date('2026-11-01T04:00:00Z'))).toEqual({ from: '2026-10-01', to: '2026-11-01' });
  });

  it('all time has no bounds', () => {
    expect(periodRange({ period: 'all' }, now)).toEqual({ from: null, to: null });
  });

  it('custom range includes the end date', () => {
    expect(periodRange({ period: 'custom', from: '2026-09-01', to: '2026-09-30' }, now)).toEqual({ from: '2026-09-01', to: '2026-10-01' });
  });

  it('custom range rejects bad or reversed dates by falling back to the month', () => {
    expect(periodRange({ period: 'custom', from: '2026-09-30', to: '2026-09-01' }, now)).toEqual({ from: '2026-10-01', to: '2026-11-01' });
    expect(periodRange({ period: 'custom', from: 'nope', to: '2026-09-01' }, now)).toEqual({ from: '2026-10-01', to: '2026-11-01' });
  });

  it('unknown periods fall back to the month', () => {
    expect(periodRange({ period: 'bogus' as never }, now)).toEqual({ from: '2026-10-01', to: '2026-11-01' });
  });

  it('every period has a label', () => {
    for (const p of PERIODS) expect(periodLabel(p)).toMatch(/\w/);
  });
});
