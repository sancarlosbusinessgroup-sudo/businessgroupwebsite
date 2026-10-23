import { describe, expect, it } from 'vitest';
import { autoChampion, monthOf, monthRange, previousMonth, scoreChampion, type ChampionInput } from './champion';

const base: ChampionInput = {
  members: [
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Bob' },
    { id: 'c', name: 'Cy' },
  ],
  referrals: [],
  closed: [],
  oneOnOnes: [],
  visitors: [],
  joined: [],
  meetingsTaken: 0,
  attendance: [],
  presentations: [],
};

describe('BARP Champion scoring', () => {
  it('adds the agreed points for each activity', () => {
    const rows = scoreChampion({
      ...base,
      referrals: [{ from_id: 'a' }, { from_id: 'a' }],
      closed: [{ from_id: 'a', amount: 1000 }],
      oneOnOnes: [{ reporter_id: 'a', partner_id: 'b' }],
      visitors: [{ referrer_id: 'b' }],
      joined: [{ referred_by: 'b' }],
      meetingsTaken: 2,
      attendance: [
        { profile_id: 'a', status: 'present', substitute: false },
        { profile_id: 'a', status: 'present', substitute: true },
        { profile_id: 'b', status: 'present', substitute: false },
        { profile_id: 'b', status: 'present', substitute: false },
      ],
      presentations: [{ profile_id: 'b' }],
    });
    // Ana: 2 referrals (10) + 1 closed (10) + 1 one-on-one (3) + 1 meeting (2) + 1 substitute (1) = 26
    // Bob: 1 one-on-one (3) + visitor (4) + joined (10) + 2 meetings (4) + presentation (3) = 24
    expect(rows.map((r) => [r.name, r.points])).toEqual([
      ['Ana', 26],
      ['Bob', 24],
    ]);
    expect(rows[0]).toMatchObject({
      referrals: 2,
      closed: 1,
      closedAmount: 1000,
      oneOnOnes: 1,
      meetings: 1,
      substitutes: 1,
      attendanceShare: 1,
      eligible: true,
    });
  });

  it('counts a one-on-one once per pair per month', () => {
    const rows = scoreChampion({
      ...base,
      oneOnOnes: [
        { reporter_id: 'a', partner_id: 'b' },
        { reporter_id: 'b', partner_id: 'a' },
        { reporter_id: 'a', partner_id: 'c' },
      ],
    });
    expect(Object.fromEntries(rows.map((r) => [r.name, r.oneOnOnes]))).toEqual({ Ana: 2, Bob: 1, Cy: 1 });
  });

  it('needs 75% attendance to qualify; the automatic pick skips anyone below', () => {
    const rows = scoreChampion({
      ...base,
      referrals: [{ from_id: 'a' }, { from_id: 'a' }, { from_id: 'a' }, { from_id: 'b' }],
      meetingsTaken: 4,
      attendance: [
        { profile_id: 'a', status: 'present', substitute: false },
        { profile_id: 'a', status: 'present', substitute: false },
        ...[1, 2, 3].map(() => ({ profile_id: 'b', status: 'present', substitute: false })),
      ],
    });
    expect(rows.find((r) => r.name === 'Ana')).toMatchObject({ attendanceShare: 0.5, eligible: false });
    expect(autoChampion(rows)?.name).toBe('Bob');
  });

  it('breaks ties on closed business, then referrals given', () => {
    const rows = scoreChampion({
      ...base,
      closed: [
        { from_id: 'a', amount: 500 },
        { from_id: 'b', amount: 900 },
      ],
    });
    expect(rows.map((r) => r.name)).toEqual(['Bob', 'Ana']);
  });

  it('nobody scores → no automatic pick', () => {
    expect(autoChampion(scoreChampion(base))).toBeNull();
  });
});

describe('months', () => {
  it('month range, label, previous month and month of a date (Pacific)', () => {
    expect(monthRange('2026-12')).toEqual({ key: '2026-12-01', from: '2026-12-01T08:00:00Z', to: '2027-01-01T08:00:00Z', label: 'December 2026' });
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(previousMonth('2026-10')).toBe('2026-09');
    expect(monthOf(new Date('2026-11-01T05:00:00Z'))).toBe('2026-10');
  });
});
