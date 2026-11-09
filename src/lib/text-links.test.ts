import { describe, expect, it } from 'vitest';
import { mapsUrl, splitLinks } from './text-links';

describe('splitLinks', () => {
  it('leaves text without addresses alone', () => {
    expect(splitLinks('Bring a friend.')).toEqual([{ type: 'text', value: 'Bring a friend.' }]);
    expect(splitLinks('')).toEqual([]);
  });

  it('finds https and www addresses and keeps the typed text', () => {
    expect(splitLinks('Sign up at https://example.org/rsvp or www.example.com today')).toEqual([
      { type: 'text', value: 'Sign up at ' },
      { type: 'link', value: 'https://example.org/rsvp', href: 'https://example.org/rsvp' },
      { type: 'text', value: ' or ' },
      { type: 'link', value: 'www.example.com', href: 'https://www.example.com' },
      { type: 'text', value: ' today' },
    ]);
  });

  it('leaves sentence punctuation out of the link', () => {
    const parts = splitLinks('Details: https://example.org/a?x=1. See you (https://example.org/b)!');
    expect(parts.filter((p) => p.type === 'link').map((p) => p.value)).toEqual(['https://example.org/a?x=1', 'https://example.org/b']);
    expect(parts[parts.length - 1]).toEqual({ type: 'text', value: ')!' });
  });

  it('keeps a closing bracket that belongs to the address', () => {
    expect(splitLinks('https://en.wikipedia.org/wiki/Up_(film)').map((p) => p.value)).toEqual(['https://en.wikipedia.org/wiki/Up_(film)']);
  });

  it('works across several lines', () => {
    const parts = splitLinks('Line one www.a.org\nLine two https://b.org/c');
    expect(parts.filter((p) => p.type === 'link')).toHaveLength(2);
    expect(parts[2]).toEqual({ type: 'text', value: '\nLine two ' });
  });

  it('ignores a bare scheme or www with nothing after it', () => {
    expect(splitLinks('https:// and www.').every((p) => p.type === 'text')).toBe(true);
  });
});

describe('mapsUrl', () => {
  it('builds the Google Maps search link with the address encoded', () => {
    const u = new URL(mapsUrl(' 1 Market St,\n San Carlos, CA 94070 '));
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/search/');
    expect(u.searchParams.get('api')).toBe('1');
    expect(u.searchParams.get('query')).toBe('1 Market St, San Carlos, CA 94070');
  });
});
