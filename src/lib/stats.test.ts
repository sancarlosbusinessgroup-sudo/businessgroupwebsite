import { describe, expect, it } from 'vitest';
import { attendancePct, barHeights, flagDuplicates } from './stats';

describe('attendancePct', () => {
  it('rounds and handles no meetings', () => {
    expect(attendancePct(11, 12)).toBe('92%');
    expect(attendancePct(0, 0)).toBe('—');
  });
});

describe('barHeights', () => {
  it('scales to the largest value and never divides by zero', () => {
    expect(
      barHeights([
        { a: 2, b: 1 },
        { a: 4, b: 0 },
      ]),
    ).toEqual([
      { a: '50%', b: '25%' },
      { a: '100%', b: '0%' },
    ]);
    expect(barHeights([{ a: 0, b: 0 }])).toEqual([{ a: '0%', b: '0%' }]);
  });
});

describe('flagDuplicates', () => {
  it('flags the same pair reported within 3 days in either direction', () => {
    const rows = [
      { id: '1', reporter_id: 'a', partner_id: 'b', met_on: '2026-09-29' },
      { id: '2', reporter_id: 'b', partner_id: 'a', met_on: '2026-09-28' },
      { id: '3', reporter_id: 'a', partner_id: 'c', met_on: '2026-09-29' },
      { id: '4', reporter_id: 'a', partner_id: 'b', met_on: '2026-09-10' },
    ];
    expect([...flagDuplicates(rows)].sort()).toEqual(['2']);
  });
});
