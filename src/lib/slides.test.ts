import { describe, expect, it } from 'vitest';
import { DEFAULT_SLIDES, SLIDE_KEYS, chunk, resolveSlides, slideLabel } from './slides';

describe('slide settings', () => {
  it('defaults follow the agreed agenda order', () => {
    expect(DEFAULT_SLIDES).toEqual([
      'welcome',
      'phones',
      'visitors',
      'newcomers',
      'asks',
      'five_minute',
      'ten_minute',
      'summary',
      'leaderboards',
      'events',
      'closing',
    ]);
    for (const k of SLIDE_KEYS) expect(slideLabel(k)).toMatch(/\w/);
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
