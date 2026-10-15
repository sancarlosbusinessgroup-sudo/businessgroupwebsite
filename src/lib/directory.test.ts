import { describe, expect, it } from 'vitest';
import { filterDirectory, paginate } from './directory';

const people = [
  { business_name: 'Harbor Lane Realty', first_name: 'Avery', last_name: 'L', about: 'Homes', categories: { name: 'Real Estate' }, approved_at: '2025-01-01' },
  {
    business_name: 'ClearTone Hearing',
    first_name: 'Wes',
    last_name: 'T',
    about: 'Hearing aids',
    categories: { name: 'Hearing Care' },
    approved_at: '2026-05-01',
  },
  { business_name: 'Atelier Interiors', first_name: 'Elena', last_name: 'V', about: null, categories: null, approved_at: '2024-01-01' },
];

describe('filterDirectory', () => {
  it('matches keyword against business, name, category and about (case-insensitive)', () => {
    expect(filterDirectory(people, { q: 'hearing' }).map((p) => p.business_name)).toEqual(['ClearTone Hearing']);
    expect(filterDirectory(people, { q: 'AVERY' })).toHaveLength(1);
    expect(filterDirectory(people, { q: 'real estate' })).toHaveLength(1);
  });
  it('filters by category and sorts', () => {
    expect(filterDirectory(people, { category: 'Real Estate' })).toHaveLength(1);
    expect(filterDirectory(people, { sort: 'name' }).map((p) => p.business_name)[0]).toBe('Atelier Interiors');
    expect(filterDirectory(people, { sort: 'newest' }).map((p) => p.business_name)[0]).toBe('ClearTone Hearing');
  });
});

describe('paginate', () => {
  it('returns the requested page and clamps out-of-range pages', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    expect(paginate(items, 2, 24)).toEqual({ page: 2, pages: 2, items: [24, 25, 26, 27, 28, 29] });
    expect(paginate(items, 9, 24).page).toBe(2);
    expect(paginate([], 1, 24)).toEqual({ page: 1, pages: 1, items: [] });
  });
});
