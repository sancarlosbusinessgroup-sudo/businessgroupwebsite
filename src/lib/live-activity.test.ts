import { describe, expect, it } from 'vitest';
import {
  activitySignature,
  isEditing,
  LIVE_COUNT_MS,
  LIVE_FLASH_MS,
  liveDelta,
  needsRefresh,
  pollDelayMs,
  POLL_FAST_MS,
  POLL_SLOW_MS,
  REPORT_KINDS,
  tweenValue,
} from './live-activity';

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
  it('is true in text fields and text areas', () => {
    expect(isEditing(make('<input type="text">'))).toBe(true);
    expect(isEditing(make('<input>'))).toBe(true);
    expect(isEditing(make('<input type="date">'))).toBe(true);
    expect(isEditing(make('<textarea></textarea>'))).toBe(true);
  });
  it('is false on menus, buttons, checkboxes and the page itself', () => {
    expect(isEditing(make('<select></select>'))).toBe(false);
    expect(isEditing(make('<button>Go</button>'))).toBe(false);
    expect(isEditing(make('<input type="checkbox">'))).toBe(false);
    expect(isEditing(make('<input type="submit">'))).toBe(false);
    expect(isEditing(document.body)).toBe(false);
    expect(isEditing(null)).toBe(false);
  });
});

describe('live highlight helpers (owner, 2026-11-26)', () => {
  it('liveDelta is the change, without float noise', () => {
    expect(liveDelta(10, 11)).toBe(1);
    expect(liveDelta(26293, 70043)).toBe(43750);
    expect(liveDelta(0.1, 0.3)).toBe(0.2);
    expect(liveDelta(5, 4)).toBe(-1);
  });
  it('tweenValue starts at the old number, ends exactly on the new one, and only shows whole numbers on the way', () => {
    expect(tweenValue(10, 20, 0)).toBe(10);
    expect(tweenValue(10, 20, 1)).toBe(20);
    expect(tweenValue(0, 43750.5, 1)).toBe(43750.5);
    const mid = tweenValue(10, 20, 0.5);
    expect(Number.isInteger(mid)).toBe(true);
    expect(mid).toBeGreaterThan(15); // eases out: past halfway at half time
    expect(tweenValue(20, 10, 0.5)).toBeLessThan(15);
    expect(tweenValue(10, 20, -1)).toBe(10);
    expect(tweenValue(10, 20, 2)).toBe(20);
  });
  it('the highlight lasts a few seconds and the count-up under one second', () => {
    expect(LIVE_FLASH_MS).toBeGreaterThanOrEqual(3000);
    expect(LIVE_COUNT_MS).toBeLessThan(1000);
  });
});
