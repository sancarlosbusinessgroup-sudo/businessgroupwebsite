import { describe, expect, it } from 'vitest';
import { goalsSummary, quarterOf, quarterOptions, quarterRange, reportCardLines, type ReportCardInput } from './report-card';

const base: ReportCardInput = {
  meetingsHeld: 6,
  attended: 5,
  substitutes: 1,
  missed: 1,
  late: 2,
  leftEarly: 1,
  oneOnOnes: 4,
  referralsGiven: 3,
  referralsReceived: 2,
  closedGiven: 1,
  closedReceived: 0,
  visitors: 0,
  presentations: 1,
};

describe('report cards (owner, 2026-11-24)', () => {
  it('quarters are Pacific calendar quarters with an exclusive end', () => {
    expect(quarterRange('2026-Q4')).toMatchObject({ from: '2026-10-01', to: '2027-01-01', label: 'Q4 2026 (Oct–Dec)' });
    expect(quarterRange('2027-Q1')).toMatchObject({ from: '2027-01-01', to: '2027-04-01' });
    expect(quarterRange('2027-Q5')).toBeNull();
    // 11 PM Pacific on Dec 31 is still Q4 (already Jan 1 in UTC).
    expect(quarterOf(new Date('2027-01-01T07:00:00Z'))).toBe('2026-Q4');
  });

  it('lists quarters from Q4 2026 to now, newest first', () => {
    expect(quarterOptions(new Date('2026-11-24T12:00:00Z')).map((q) => q.key)).toEqual(['2026-Q4']);
    expect(quarterOptions(new Date('2027-05-02T12:00:00Z')).map((q) => q.key)).toEqual(['2027-Q2', '2027-Q1', '2026-Q4']);
  });

  it('compares each line with its goal; no goal, no verdict', () => {
    const lines = reportCardLines(base, { one_on_ones: 6, referrals: 3, visitors: null, attendance_pct: 80 });
    const by = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(by.attendance).toMatchObject({ value: '5 of 6 (83%), 1 with a substitute', goal: '80%', met: true });
    expect(by.one_on_ones).toMatchObject({ value: '4', goal: '6', met: false });
    expect(by.referrals).toMatchObject({ met: true });
    expect(by.visitors).toMatchObject({ goal: null, met: null });
    expect(goalsSummary(lines)).toEqual({ met: 2, total: 3 });
    expect(goalsSummary(reportCardLines(base, { one_on_ones: null, referrals: null, visitors: null, attendance_pct: null }))).toBeNull();
  });

  it('says so when no attendance was taken', () => {
    const lines = reportCardLines({ ...base, meetingsHeld: 0, attended: 0 }, { one_on_ones: null, referrals: null, visitors: null, attendance_pct: 75 });
    expect(lines[0]).toMatchObject({ value: 'No meetings with attendance taken', met: null });
  });
});
