import { describe, expect, it } from 'vitest';
import { attendanceHistory } from './attendance';

const meetings = [
  { id: 'm1', starts_at: '2026-10-12T15:15:00Z' },
  { id: 'm2', starts_at: '2026-09-28T15:15:00Z' },
  { id: 'm3', starts_at: '2026-09-14T15:15:00Z' },
  { id: 'm4', starts_at: '2026-08-31T15:15:00Z' },
];

describe('attendanceHistory', () => {
  it('marks meetings without a record as absent and counts the current streak', () => {
    const rows = [
      { meeting_id: 'm1', status: 'present' as const, checked_in_at: '2026-10-12T15:11:00Z', method: 'self' },
      { meeting_id: 'm2', status: 'present' as const, checked_in_at: null, method: 'admin' },
      { meeting_id: 'm4', status: 'present' as const, checked_in_at: null, method: 'self' },
    ];
    const h = attendanceHistory(meetings, rows);
    expect(h.items.map((i) => i.status)).toEqual(['present', 'present', 'absent', 'present']);
    expect(h.streak).toBe(2);
    expect(h.present).toBe(3);
    expect(h.held).toBe(4);
  });

  it('an excused absence does not break the streak', () => {
    const rows = [
      { meeting_id: 'm1', status: 'present' as const, checked_in_at: null, method: 'self' },
      { meeting_id: 'm2', status: 'excused' as const, checked_in_at: null, method: 'admin' },
      { meeting_id: 'm3', status: 'present' as const, checked_in_at: null, method: 'self' },
    ];
    expect(attendanceHistory(meetings, rows).streak).toBe(2);
  });
});
