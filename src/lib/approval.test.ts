import { describe, expect, it } from 'vitest';
import { isLoginNotice, loginNotices, noticeFor } from './approval';

describe('only approved members can log in', () => {
  it('picks the explanation for each account status', () => {
    expect(noticeFor('pending')).toBe('pending');
    expect(noticeFor(null)).toBe('pending');
    expect(noticeFor('declined')).toBe('inactive');
    expect(noticeFor('inactive')).toBe('inactive');
  });
  it('knows the notices the login page can show', () => {
    for (const k of ['confirmed', 'pending', 'inactive']) expect(isLoginNotice(k)).toBe(true);
    expect(isLoginNotice('link')).toBe(false);
    expect(loginNotices.pending).toMatch(/once the leadership team approves your membership/);
  });
});
