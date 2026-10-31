import { describe, expect, it } from 'vitest';
import { isSupportStaff } from './people';

describe('isSupportStaff (owner, 2026-10-30)', () => {
  it('is true for the "Support Team" accounts only', () => {
    expect(isSupportStaff({ business_name: 'Support Team' })).toBe(true);
    expect(isSupportStaff({ business_name: ' support team ' })).toBe(true);
    expect(isSupportStaff({ business_name: 'Within Range Coaching' })).toBe(false);
    expect(isSupportStaff({ business_name: null })).toBe(false);
    expect(isSupportStaff(null)).toBe(false);
  });
});
