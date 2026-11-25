import { describe, expect, it } from 'vitest';
import { activitySignature, isEditing, needsRefresh, pollDelayMs, POLL_FAST_MS, POLL_SLOW_MS, REPORT_KINDS } from './live-activity';

describe('activitySignature', () => {
  const rows = [
    { kind: 'referrals', version: 3 },
    { kind: 'one_on_ones', version: '5' },
    { kind: 'visitors', version: 2 },
    { kind: 'attendance', version: 40 },
    { kind: 'champion', version: 1 },
    { kind: 'unknown', version: 99 },
  ];
  it('adds up every known kind by default', () => {
    expect(activitySignature(rows)).toBe(51);
  });
  it('adds up only the kinds a page shows', () => {
    expect(activitySignature(rows, REPORT_KINDS)).toBe(10);
  });
  it('treats missing or bad values as 0', () => {
    expect(activitySignature([{ kind: 'referrals', version: 'x' }])).toBe(0);
    expect(activitySignature([])).toBe(0);
  });
  it('goes up when any one counter goes up', () => {
    const before = activitySignature(rows);
    const after = activitySignature(rows.map((r) => (r.kind === 'visitors' ? { ...r, version: 3 } : r)));
    expect(after).toBeGreaterThan(before);
  });
});

describe('needsRefresh', () => {
  it('reloads when the database is ahead of what the page shows', () => {
    expect(needsRefresh(11, 10, 10)).toBe(true);
  });
  it('does nothing when the page is up to date', () => {
    expect(needsRefresh(10, 10, 10)).toBe(false);
    expect(needsRefresh(9, 10, 10)).toBe(false);
  });
  it('asks only once for the same change', () => {
    expect(needsRefresh(11, 10, 11)).toBe(false);
    expect(needsRefresh(12, 10, 11)).toBe(true);
  });
  it('treats an unknown rendered total as 0, without looping after a reload was asked for', () => {
    expect(needsRefresh(5, null, 0)).toBe(true);
    expect(needsRefresh(5, null, 5)).toBe(false);
  });
});

describe('pollDelayMs', () => {
  it('polls often without Realtime and rarely with it', () => {
    expect(pollDelayMs(false)).toBe(POLL_FAST_MS);
    expect(pollDelayMs(true)).toBe(POLL_SLOW_MS);
    expect(POLL_FAST_MS).toBeLessThanOrEqual(5000);
  });
});

describe('isEditing', () => {
  const make = (html: string) => {
    document.body.innerHTML = html;
    return document.body.firstElementChild;
  };
  it('is true in text fields, text areas and selects', () => {
    expect(isEditing(make('<input type="text">'))).toBe(true);
    expect(isEditing(make('<input>'))).toBe(true);
    expect(isEditing(make('<input type="date">'))).toBe(true);
    expect(isEditing(make('<textarea></textarea>'))).toBe(true);
    expect(isEditing(make('<select></select>'))).toBe(true);
  });
  it('is false on buttons, checkboxes and the page itself', () => {
    expect(isEditing(make('<button>Go</button>'))).toBe(false);
    expect(isEditing(make('<input type="checkbox">'))).toBe(false);
    expect(isEditing(make('<input type="submit">'))).toBe(false);
    expect(isEditing(document.body)).toBe(false);
    expect(isEditing(null)).toBe(false);
  });
});
