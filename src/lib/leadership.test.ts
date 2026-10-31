import { describe, expect, it } from 'vitest';
import { groupLeadership } from './leadership';

describe('groupLeadership', () => {
  it('splits roles into leadership, Membership Committee and Attendance Managers', () => {
    const g = groupLeadership([
      { id: '1', name: 'Vivienne Kelvin', role: 'Team Leader' },
      { id: '2', name: 'Mark Rogers', role: 'Time Manager · Membership Committee' },
      { id: '3', name: 'David Flaig', role: 'Membership Committee' },
      { id: '4', name: 'Shannon Kampa', role: 'Attendance Manager' },
    ]);
    expect(g.leaders.map((l) => [l.name, l.title])).toEqual([
      ['Vivienne Kelvin', 'Team Leader'],
      ['Mark Rogers', 'Time Manager'],
    ]);
    expect(g.committee.map((c) => c.name)).toEqual(['Mark Rogers', 'David Flaig']);
    expect(g.attendance.map((c) => c.name)).toEqual(['Shannon Kampa']);
  });

  it('puts Member Coaches in their own group, not with the other roles (owner, 2026-10-30)', () => {
    const g = groupLeadership([
      { id: '1', name: 'Jeanie Jackson', role: 'Speaker Schedule' },
      { id: '2', name: 'Ranger Kielak', role: 'Member Coach' },
    ]);
    expect(g.leaders.map((l) => l.name)).toEqual(['Jeanie Jackson']);
    expect(g.coaches.map((c) => c.name)).toEqual(['Ranger Kielak']);
  });
});
