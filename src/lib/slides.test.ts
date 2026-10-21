import { describe, expect, it } from 'vitest';
import { DEFAULT_SLIDES, SLIDE_KEYS, chunk, parseWebsite, parseYouTube, resolveNotes, resolveSlides, slideLabel, slideTime } from './slides';

describe('slide settings', () => {
  it('defaults: the owner’s standard deck, in agenda order (Procedures, effective October 19, 2026)', () => {
    expect(DEFAULT_SLIDES).toEqual([
      'welcome',
      'networking',
      'call_to_order',
      'leadership',
      'guests',
      'infomercials',
      'statistics',
      'leaderboards',
      'five_minute',
      'five_qa',
      'ten_minute',
      'ten_qa',
      'announcements',
      'adjourn',
    ]);
    // Still available to add per meeting, but not in the standard deck (owner, 2026-10-21).
    for (const k of ['agenda', 'asks', 'visitors_thanks'] as const) {
      expect(SLIDE_KEYS).toContain(k);
      expect(DEFAULT_SLIDES).not.toContain(k);
    }
    expect([slideTime('networking'), slideTime('call_to_order'), slideTime('infomercials'), slideTime('five_qa'), slideTime('ten_minute'), slideTime('adjourn')]).toEqual([
      '8:15',
      '8:30',
      '8:33',
      '9:10',
      '9:11',
      '9:30',
    ]);
    expect(slideLabel('infomercials')).toBe('60-second infomercials');
    for (const k of SLIDE_KEYS) expect(slideLabel(k)).toMatch(/\w/);
  });

  it('settings saved with the old slide names still work', () => {
    expect(resolveSlides(['welcome', 'phones', 'roundtable', 'summary', 'events', 'closing'])).toEqual([
      'welcome',
      'call_to_order',
      'infomercials',
      'statistics',
      'announcements',
      'adjourn',
    ]);
    expect(resolveNotes({ roundtable: 'Shout-out', events: 'Mixer Friday' })).toEqual({ infomercials: 'Shout-out', announcements: 'Mixer Friday' });
  });

  it('extra slide text keeps only known slides with text', () => {
    expect(resolveNotes({ welcome: '  Happy holidays!  ', bogus: 'x', announcements: '', adjourn: 3 })).toEqual({ welcome: 'Happy holidays!' });
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

describe('parseYouTube', () => {
  it('reads the video id and start time from the usual link shapes', () => {
    expect(parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ id: 'dQw4w9WgXcQ', start: 0 });
    expect(parseYouTube('https://youtu.be/dQw4w9WgXcQ?t=90')).toEqual({ id: 'dQw4w9WgXcQ', start: 90 });
    expect(parseYouTube('youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')).toEqual({ id: 'dQw4w9WgXcQ', start: 90 });
    expect(parseYouTube('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ id: 'dQw4w9WgXcQ', start: 0 });
    expect(parseYouTube('https://www.youtube.com/embed/dQw4w9WgXcQ?start=12')).toEqual({ id: 'dQw4w9WgXcQ', start: 12 });
    expect(parseYouTube('https://m.youtube.com/live/dQw4w9WgXcQ')).toEqual({ id: 'dQw4w9WgXcQ', start: 0 });
  });

  it('rejects anything that is not a YouTube video link', () => {
    expect(parseYouTube('https://vimeo.com/123')).toBeNull();
    expect(parseYouTube('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseYouTube('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTube('not a link at all')).toBeNull();
  });
});

describe('parseWebsite', () => {
  it('accepts https website links (adding https:// when left out) and keeps long tracking links whole', () => {
    const long =
      'https://bbemaildelivery.com/bbext/?p=video_land&id=a09a5bf9-a634-4eea-ad4c-2c1d7bf630e0&beid=gm%3A2046e282-0926-44f0-a8a7-1b66fdbd851f&beaddr=viv%40example.com';
    expect(parseWebsite(long)).toBe(long);
    expect(parseWebsite('example.com/page')).toBe('https://example.com/page');
  });

  it('refuses insecure, odd or malformed links', () => {
    expect(parseWebsite('http://example.com')).toBeNull();
    expect(parseWebsite('javascript:alert(1)')).toBeNull();
    expect(parseWebsite('https://user:pass@example.com')).toBeNull();
    expect(parseWebsite('https://localhost/x')).toBeNull();
    expect(parseWebsite('not a link')).toBeNull();
    expect(parseWebsite(`https://example.com/${'a'.repeat(2001)}`)).toBeNull();
  });
});
