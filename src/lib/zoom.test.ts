import { describe, expect, it } from 'vitest';
import { absenceSummary, lateEarly, matchParticipant, mergeParticipants, nameKey, noSessionMessage, normalizeName, parseZoomMeetingId } from './zoom';

describe('parseZoomMeetingId', () => {
  it('reads the meeting ID from the usual join links', () => {
    expect(parseZoomMeetingId('https://us02web.zoom.us/j/83818742413?pwd=abc')).toBe('83818742413');
    expect(parseZoomMeetingId('https://zoom.us/j/123456789')).toBe('123456789');
    expect(parseZoomMeetingId('https://us06web.zoom.us/wc/join/98765432101')).toBe('98765432101');
    expect(parseZoomMeetingId('https://example.com/j/83818742413')).toBeNull();
    expect(parseZoomMeetingId(null)).toBeNull();
  });
});

describe('normalizeName', () => {
  it('ignores case, accents, titles and anything after a separator', () => {
    expect(normalizeName('Viv Kelvin | Vabrato')).toBe('viv kelvin');
    expect(normalizeName('José  Núñez - Núñez Law')).toBe('jose nunez');
    expect(normalizeName('Dr. Sami Lang, DC')).toBe('sami lang');
    expect(normalizeName("Mary-Jane O'Neil (she/her)")).toBe('mary jane oneil');
  });
});

describe('mergeParticipants', () => {
  it('merges rejoins into one person: earliest join, latest leave, total minutes', () => {
    const out = mergeParticipants([
      { name: 'Avery Lindqvist', user_email: 'Avery@Example.test', join_time: '2026-10-26T15:20:00Z', leave_time: '2026-10-26T15:50:00Z', duration: 1800 },
      { name: 'Avery (iPad)', user_email: 'avery@example.test', join_time: '2026-10-26T15:55:00Z', leave_time: '2026-10-26T16:30:00Z', duration: 2100 },
      { name: 'iPhone', user_email: '', join_time: '2026-10-26T15:30:00Z', leave_time: '2026-10-26T16:30:00Z', duration: 3600 },
    ]);
    expect(out).toEqual([
      {
        key: 'email:avery@example.test',
        name: 'Avery Lindqvist',
        email: 'avery@example.test',
        joinedAt: '2026-10-26T15:20:00Z',
        leftAt: '2026-10-26T16:30:00Z',
        minutes: 65,
      },
      { key: 'name:iphone', name: 'iPhone', email: null, joinedAt: '2026-10-26T15:30:00Z', leftAt: '2026-10-26T16:30:00Z', minutes: 60 },
    ]);
  });
});

describe('matchParticipant', () => {
  const members = [
    { id: 'm1', firstName: 'Avery', lastName: 'Lindqvist', email: 'avery@example.test' },
    { id: 'm2', firstName: 'Mark', lastName: 'Rogers', email: 'mark@example.test' },
    { id: 'm3', firstName: 'Mark', lastName: 'Rogers', email: 'mark2@example.test' },
    { id: 'm4', firstName: 'Priya', lastName: 'Raman', email: null },
  ];
  const guests = [{ id: 'g1', firstName: 'Gina', lastName: 'Guest', email: 'gina@example.test' }];
  const p = (name: string, email: string | null = null) => ({ key: '', name, email, joinedAt: null, leftAt: null, minutes: 0 });

  it('matches by email first, then by unique full name, then guests; otherwise leaves it for review', () => {
    const none = new Map<string, string>();
    expect(matchParticipant(p('Someone', 'avery@example.test'), members, guests, none)).toEqual({ kind: 'member', profileId: 'm1', by: 'email' });
    expect(matchParticipant(p('Priya Raman | Golden Years'), members, guests, none)).toEqual({ kind: 'member', profileId: 'm4', by: 'name' });
    expect(matchParticipant(p('Gina Guest', 'gina@example.test'), members, guests, none)).toEqual({ kind: 'guest', guestId: 'g1', by: 'email' });
    expect(matchParticipant(p('Gina Guest'), members, guests, none)).toEqual({ kind: 'guest', guestId: 'g1', by: 'name' });
    // Two members share the name: never guess.
    expect(matchParticipant(p('Mark Rogers'), members, guests, none)).toEqual({ kind: 'pending' });
    // First name only is not enough.
    expect(matchParticipant(p('Avery'), members, guests, none)).toEqual({ kind: 'pending' });
    expect(matchParticipant(p('iPhone'), members, guests, none)).toEqual({ kind: 'pending' });
  });

  it('uses a name an admin linked before', () => {
    const aliases = new Map([[nameKey('iPhone (2)'), 'm2']]);
    expect(matchParticipant(p('iPhone (2)'), members, guests, aliases)).toEqual({ kind: 'member', profileId: 'm2', by: 'alias' });
  });
});

describe('lateEarly', () => {
  const meeting = { starts_at: '2026-10-26T15:15:00Z', ends_at: '2026-10-26T16:30:00Z' }; // 8:15–9:30 AM PT
  it('flags joining after 8:30 and leaving before 9:30, with a minute of grace', () => {
    expect(lateEarly(meeting, '2026-10-26T15:30:30Z', '2026-10-26T16:29:30Z')).toEqual({ late: false, leftEarly: false });
    expect(lateEarly(meeting, '2026-10-26T15:35:00Z', '2026-10-26T16:30:00Z')).toEqual({ late: true, leftEarly: false });
    expect(lateEarly(meeting, '2026-10-26T15:20:00Z', '2026-10-26T16:10:00Z')).toEqual({ late: false, leftEarly: true });
    expect(lateEarly(meeting, null, null)).toEqual({ late: false, leftEarly: false });
  });
});

describe('absenceSummary', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  const taken = [
    { meeting_id: 'a', starts_at: '2026-05-01T15:15:00Z' }, // older than 6 months
    { meeting_id: 'b', starts_at: '2026-10-26T15:15:00Z' },
    { meeting_id: 'c', starts_at: '2026-11-09T15:15:00Z' },
    { meeting_id: 'd', starts_at: '2026-11-23T15:15:00Z' },
  ];
  it('counts only meetings with attendance taken in the last 6 months; substitutes count as attended, excused as missed', () => {
    const s = absenceSummary(
      taken,
      [
        { meeting_id: 'b', status: 'present' },
        { meeting_id: 'c', status: 'excused' },
        { meeting_id: 'd', status: 'absent', substitute: true },
      ],
      { now },
    );
    expect(s).toMatchObject({ counted: 3, missed: 1, missedMeetings: ['c'], atLimit: false });
    expect(absenceSummary(taken, [], { now })).toMatchObject({ missed: 3, atLimit: true, overLimit: true });
  });
  it('ignores meetings from before the member joined', () => {
    expect(absenceSummary(taken, [], { now, memberSince: '2026-11-01' })).toMatchObject({ counted: 2, missed: 2, atLimit: true, overLimit: false });
  });
});

describe('noSessionMessage', () => {
  it('lists the most recent days Zoom has (Pacific dates, newest first, at most five)', () => {
    const msg = noSessionMessage('83818742413', [
      { start_time: '2026-09-28T15:20:00Z' },
      { start_time: '2026-10-05T15:14:00Z' },
      { start_time: '2026-10-05T16:40:00Z' },
      { start_time: '2026-10-20T02:00:00Z' }, // Oct 19 in California
    ]);
    expect(msg).toBe('Zoom has no session of meeting 838 1874 2413 on that day. Its most recent sessions were on Oct 19, 2026, Oct 5, 2026, Sep 28, 2026.');
  });
  it('says so when the meeting ID has never been used', () => {
    expect(noSessionMessage('83818742413', [])).toMatch(/no past sessions of meeting 838 1874 2413 at all/);
  });
});
