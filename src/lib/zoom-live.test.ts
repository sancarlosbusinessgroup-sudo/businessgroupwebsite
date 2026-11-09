import { describe, expect, it } from 'vitest';
import { isLiveWindow, liveSummary, parseParticipantEvent, pickLiveMeeting, urlValidationResponse, verifyZoomRequest, zoomSignature } from './zoom-live';

const SECRET = 'test-secret';
// Nov 9, 2026, 8:15–9:30 AM Pacific.
const meeting = { starts_at: '2026-11-09T16:15:00Z', ends_at: '2026-11-09T17:30:00Z' };
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 10, 9, h! + 8, m!)).toISOString();
};

describe('verifyZoomRequest', () => {
  const body = '{"event":"meeting.participant_joined"}';
  const now = 1_762_700_000_000;
  const ts = String(Math.floor(now / 1000));

  it('accepts Zoom’s signature', () => {
    expect(verifyZoomRequest(SECRET, zoomSignature(SECRET, ts, body), ts, body, now)).toBe(true);
  });
  it('rejects a wrong secret, a changed body, missing headers and an old timestamp', () => {
    expect(verifyZoomRequest(SECRET, zoomSignature('other', ts, body), ts, body, now)).toBe(false);
    expect(verifyZoomRequest(SECRET, zoomSignature(SECRET, ts, body), ts, `${body} `, now)).toBe(false);
    expect(verifyZoomRequest(SECRET, null, ts, body, now)).toBe(false);
    expect(verifyZoomRequest(SECRET, zoomSignature(SECRET, ts, body), null, body, now)).toBe(false);
    expect(verifyZoomRequest('', zoomSignature('', ts, body), ts, body, now)).toBe(false);
    const old = String(Math.floor(now / 1000) - 6 * 60);
    expect(verifyZoomRequest(SECRET, zoomSignature(SECRET, old, body), old, body, now)).toBe(false);
  });
});

it('answers Zoom’s endpoint check with the HMAC of the plain token', () => {
  expect(urlValidationResponse(SECRET, 'abc')).toEqual({
    plainToken: 'abc',
    encryptedToken: expect.stringMatching(/^[0-9a-f]{64}$/),
  });
});

describe('parseParticipantEvent', () => {
  it('reads joins and leaves, keyed by email or else by name', () => {
    expect(
      parseParticipantEvent({
        event: 'meeting.participant_joined',
        payload: { object: { id: '86333442174', participant: { user_name: 'Priya R', email: 'Priya@Example.com', join_time: '2026-11-09T16:20:00Z' } } },
      }),
    ).toEqual({
      zoomId: '86333442174',
      event: 'joined',
      key: 'email:priya@example.com',
      name: 'Priya R',
      email: 'priya@example.com',
      at: '2026-11-09T16:20:00.000Z',
    });
    expect(
      parseParticipantEvent({
        event: 'meeting.participant_left',
        payload: { object: { id: 86333442174, participant: { user_name: 'iPhone', email: '', leave_time: '2026-11-09T17:00:00Z' } } },
      }),
    ).toMatchObject({ event: 'left', key: 'name:iphone', email: null, at: '2026-11-09T17:00:00.000Z' });
  });
  it('ignores other events and broken payloads', () => {
    expect(parseParticipantEvent({ event: 'meeting.started', payload: { object: { id: '1' } } })).toBeNull();
    expect(parseParticipantEvent({ event: 'meeting.participant_joined', payload: { object: { id: '1' } } })).toBeNull();
    expect(parseParticipantEvent(null)).toBeNull();
  });
});

it('pickLiveMeeting finds the meeting by Zoom ID and time', () => {
  const link = 'https://us02web.zoom.us/j/86333442174?pwd=x';
  const list = [
    { id: 'old', starts_at: '2026-10-26T15:15:00Z', ends_at: '2026-10-26T16:30:00Z', join_url: link },
    { id: 'today', ...meeting, join_url: link },
    { id: 'other-zoom', ...meeting, join_url: 'https://zoom.us/j/12345678901' },
  ];
  expect(pickLiveMeeting(list, '86333442174', at('8:05'))).toBe('today');
  expect(pickLiveMeeting(list, '86333442174', at('10:15'))).toBe('today');
  expect(pickLiveMeeting(list, '86333442174', at('12:00'))).toBeNull();
  expect(pickLiveMeeting(list, '99999999999', at('8:30'))).toBeNull();
});

describe('liveSummary', () => {
  const members = [
    { id: 'p', firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com' },
    { id: 'e', firstName: 'Elena', lastName: 'Vasquez', email: null },
    { id: 't', firstName: 'Theo', lastName: 'Marchetti', email: null },
    { id: 'd', firstName: 'Daniel', lastName: 'Cho', email: null },
  ];
  const guests = [{ id: 'g', firstName: 'Quinn', lastName: 'Visitorson', email: 'quinn@example.org' }];
  const ev = (event: 'joined' | 'left', name: string, time: string, email: string | null = null) => ({
    event,
    key: email ? `email:${email}` : `name:${name.toLowerCase()}`,
    name,
    email,
    at: at(time),
  });

  it('sorts members into on time, late and not here yet; flags unknown names and guests', () => {
    const s = liveSummary(
      [
        ev('joined', 'Priya R', '8:10', 'priya@example.com'),
        ev('left', 'Priya R', '8:40', 'priya@example.com'),
        ev('joined', 'Priya (phone)', '8:41', 'priya@example.com'),
        ev('joined', 'Elena Vasquez | Atelier', '8:37'),
        ev('joined', 'iPhone', '8:12'),
        ev('joined', 'Quinn Visitorson', '8:20'),
      ],
      meeting,
      members,
      guests,
      new Map(),
    );
    expect(s.onTime).toEqual([expect.objectContaining({ name: 'Priya Raman', inNow: true, joinedAt: at('8:10'), minutesLate: 0 })]);
    expect(s.late).toEqual([expect.objectContaining({ name: 'Elena Vasquez', minutesLate: 7 })]);
    expect(s.notYet.map((m) => m.name)).toEqual(['Daniel Cho', 'Theo Marchetti']);
    expect(s.unknown).toEqual([expect.objectContaining({ key: 'name:iphone', name: 'iPhone' })]);
    expect(s.visitors).toEqual([expect.objectContaining({ name: 'Quinn Visitorson' })]);
  });

  it('uses the 8:30 cutoff with one minute’s grace, remembered names, and merges two devices of one member', () => {
    const s = liveSummary(
      [ev('joined', 'Daniel Cho', '8:31'), ev('joined', 'iPhone', '8:32'), ev('left', 'iPhone', '9:00'), ev('joined', 'Theo M', '8:29')],
      meeting,
      members,
      guests,
      new Map([
        ['name:iphone', 't'],
        ['name:theo m', 't'],
      ]),
    );
    expect(s.onTime.map((p) => p.name)).toEqual(['Theo Marchetti', 'Daniel Cho']);
    expect(s.onTime[0]).toMatchObject({ joinedAt: at('8:29'), inNow: true, leftAt: null });
    expect(s.late).toEqual([]);
    expect(s.unknown).toEqual([]);
  });

  it('shows who has left', () => {
    const s = liveSummary([ev('joined', 'Daniel Cho', '8:20'), ev('left', 'Daniel Cho', '9:05')], meeting, members, guests, new Map());
    expect(s.onTime[0]).toMatchObject({ inNow: false, leftAt: at('9:05') });
  });
});

it('isLiveWindow: an hour before the start to an hour after the end', () => {
  expect(isLiveWindow(meeting, new Date(at('7:20')))).toBe(true);
  expect(isLiveWindow(meeting, new Date(at('7:10')))).toBe(false);
  expect(isLiveWindow(meeting, new Date(at('10:30')))).toBe(true);
  expect(isLiveWindow(meeting, new Date(at('10:31')))).toBe(false);
});
