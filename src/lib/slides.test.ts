import { describe, expect, it } from 'vitest';
import { DEFAULT_SLIDES, SLIDE_KEYS, chunk, resolveNotes, resolveSlides, slideLabel } from './slides';

describe('slide settings', () => {
  it('defaults follow the meeting format: networking, introductions, roundtable, numbers, presentations, events & announcements', () => {
    expect(DEFAULT_SLIDES).toEqual([
      'welcome',
      'networking',
      'phones',
      'introductions',
      'visitors',
      'newcomers',
      'roundtable',
      'asks',
      'summary',
      'leaderboards',
      'five_minute',
      'ten_minute',
      'events',
      'closing',
    ]);
    expect(slideLabel('networking')).toContain('8:15 – 8:30 AM');
    expect(slideLabel('summary')).toBe('Activity numbers');
    expect(slideLabel('events')).toBe('Events & announcements');
    for (const k of SLIDE_KEYS) expect(slideLabel(k)).toMatch(/\w/);
  });

  it('extra slide text keeps only known slides with text', () => {
    expect(resolveNotes({ welcome: '  Happy holidays!  ', bogus: 'x', events: '', phones: 3 })).toEqual({ welcome: 'Happy holidays!' });
    expect(resolveNotes(null)).toEqual({});
    expect(resolveNotes(['welcome'])).toEqual({});
  });

  it('uses saved settings, dropping unknown and duplicate keys', () => {
    expect(resolveSlides(['welcome', 'bogus', 'ten_minute', 'welcome', 'five_minute'])).toEqual(['welcome', 'ten_minute', 'five_minute']);
  });

  it('falls back to the defaults when nothing valid is saved', () => {
    expect(resolveSlides(null)).toEqual(DEFAULT_SLIDES);
    expect(resolveSlides([])).toEqual(DEFAULT_SLIDES);
    expect(resolveSlides(['nope'])).toEqual(DEFAULT_SLIDES);
  });
});

describe('chunk', () => {
  it('splits a list into pages of n', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
