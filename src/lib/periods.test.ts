import { describe, expect, it } from 'vitest';
import { PERIODS, monthRange, periodChoices, periodLabel, periodRange, pickPeriod } from './periods';

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

describe('period picker (owner, 2026-11-25)', () => {
  const now = new Date('2026-11-25T20:00:00Z');
  it('defaults to this month', () => {
    expect(pickPeriod(undefined, now)).toEqual({
      value: '2026-11',
      label: 'November 2026',
      range: { from: '2026-11-01', to: '2026-12-01' },
      isCurrentMonth: true,
    });
  });
  it('reads any past month, including across a year', () => {
    expect(pickPeriod('2026-07', now)).toMatchObject({ value: '2026-07', label: 'July 2026', range: { from: '2026-07-01', to: '2026-08-01' }, isCurrentMonth: false });
    expect(pickPeriod('2025-12', now).range).toEqual({ from: '2025-12-01', to: '2026-01-01' });
  });
  it('quarter, year and all time', () => {
    expect(pickPeriod('quarter', now)).toMatchObject({ label: 'This quarter', range: { from: '2026-10-01', to: '2027-01-01' } });
    expect(pickPeriod('year', now)).toMatchObject({ label: '2026 so far', range: { from: '2026-01-01', to: '2027-01-01' } });
    expect(pickPeriod('all', now)).toMatchObject({ label: 'All time', range: { from: null, to: null } });
  });
  it('a future, malformed or impossible month falls back to this month', () => {
    for (const v of ['2026-12', '2027-01', '2026-13', 'nonsense', '']) expect(pickPeriod(v, now).value).toBe('2026-11');
  });
  it('uses the Pacific date: late on Nov 30 Pacific is still November', () => {
    expect(pickPeriod(undefined, new Date('2026-12-01T06:00:00Z')).value).toBe('2026-11');
  });
  it('lists this month and the 11 before it, then quarter, year and all time', () => {
    const c = periodChoices(now);
    expect(c).toHaveLength(15);
    expect(c[0]).toEqual({ value: '2026-11', label: 'November 2026 (this month)' });
    expect(c[11]).toEqual({ value: '2025-12', label: 'December 2025' });
    expect(c.slice(12).map((x) => x.value)).toEqual(['quarter', 'year', 'all']);
    expect(c[13]?.label).toBe('This year (2026)');
  });
  it('monthRange rejects bad months', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-03-01' });
    expect(monthRange('2026-00')).toBeNull();
    expect(monthRange('26-1')).toBeNull();
  });
});
