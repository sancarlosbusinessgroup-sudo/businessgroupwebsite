import { describe, expect, it } from 'vitest';
import { toCsv, toVcards } from './exports';

describe('toCsv', () => {
  it('starts with a BOM so Excel reads UTF-8, uses CRLF, and quotes only when needed', () => {
    const csv = toCsv(
      ['Name', 'Note'],
      [
        ['Ana Núñez', 'plain'],
        ['Bo "Bear" Lee', 'a, b'],
        ['Cy', 'line1\nline2'],
        ['Di', null],
      ],
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual(['Name,Note', 'Ana Núñez,plain', '"Bo ""Bear"" Lee","a, b"', 'Cy,"line1\nline2"', 'Di,', '']);
  });

  it('neutralises spreadsheet formulas', () => {
    const csv = toCsv(['A'], [['=HYPERLINK("x")'], ['+1'], ['-2'], ['@x']]);
    expect(csv.slice(1).split('\r\n').slice(1, 5)).toEqual([`"'=HYPERLINK(""x"")"`, "'+1", "'-2", "'@x"]);
  });
});

describe('toVcards', () => {
  it('builds one vCard 3.0 per member and escapes special characters', () => {
    const out = toVcards([
      {
        firstName: 'Ana',
        lastName: 'Núñez',
        business: 'Núñez; Sons, Inc',
        category: 'Real Estate',
        email: 'ana@example.org',
        phone: '(650) 555-0101',
        website: 'https://example.org',
      },
      { firstName: 'Bo', lastName: 'Lee', business: 'Lee Co', category: null, email: null, phone: null, website: null },
    ]);
    const cards = out.split('BEGIN:VCARD').filter(Boolean);
    expect(cards).toHaveLength(2);
    expect(out).toContain('VERSION:3.0\r\n');
    expect(out).toContain('N:Núñez;Ana;;;\r\n');
    expect(out).toContain('FN:Ana Núñez\r\n');
    expect(out).toContain('ORG:Núñez\\; Sons\\, Inc\r\n');
    expect(out).toContain('TITLE:Real Estate\r\n');
    expect(out).toContain('EMAIL;TYPE=INTERNET:ana@example.org\r\n');
    expect(out).toContain('TEL;TYPE=WORK,VOICE:(650) 555-0101\r\n');
    expect(out).toContain('URL:https://example.org\r\n');
    expect(cards[1]).not.toContain('EMAIL');
    expect(cards[1]).not.toContain('TEL');
    expect(out.trimEnd().endsWith('END:VCARD')).toBe(true);
  });
});
