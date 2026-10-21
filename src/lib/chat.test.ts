import { describe, expect, it } from 'vitest';
import { chatHiddenOn, chatVisitor, tawkConfig, tawkEmbedUrl } from './chat';

describe('tawkConfig', () => {
  it('returns the IDs when both are set and well-formed', () => {
    expect(tawkConfig('64f1a2b3c4d5e6f708192a3b', '1h9abc2de')).toEqual({ propertyId: '64f1a2b3c4d5e6f708192a3b', widgetId: '1h9abc2de' });
  });

  it('trims spaces pasted with the IDs', () => {
    expect(tawkConfig('  64f1a2b3c4d5e6f708192a3b ', ' default ')).toEqual({ propertyId: '64f1a2b3c4d5e6f708192a3b', widgetId: 'default' });
  });

  it('is off (null) when an ID is missing', () => {
    expect(tawkConfig(undefined, '1h9abc2de')).toBeNull();
    expect(tawkConfig('64f1a2b3c4d5e6f708192a3b', undefined)).toBeNull();
    expect(tawkConfig('', '')).toBeNull();
  });

  it('is off (null) when an ID is malformed, so nothing odd ends up in the script address', () => {
    expect(tawkConfig('not-a-property', '1h9abc2de')).toBeNull();
    expect(tawkConfig('64f1a2b3c4d5e6f708192a3b', '../evil')).toBeNull();
    expect(tawkConfig('64f1a2b3c4d5e6f708192a3b', 'a b')).toBeNull();
  });
});

describe('tawkEmbedUrl', () => {
  it('builds the tawk.to embed address', () => {
    expect(tawkEmbedUrl({ propertyId: '64f1a2b3c4d5e6f708192a3b', widgetId: '1h9abc2de' })).toBe('https://embed.tawk.to/64f1a2b3c4d5e6f708192a3b/1h9abc2de');
  });
});

describe('chatHiddenOn', () => {
  it('hides the chat bubble on the meeting slides only', () => {
    expect(chatHiddenOn('/present/next')).toBe(true);
    expect(chatHiddenOn('/present/2026-10-26/setup')).toBe(true);
    expect(chatHiddenOn('/present')).toBe(true);
    expect(chatHiddenOn('/')).toBe(false);
    expect(chatHiddenOn('/support')).toBe(false);
    expect(chatHiddenOn('/presentations')).toBe(false);
  });
});

describe('chatVisitor', () => {
  it('passes a signed-in member’s name and email to the chat', () => {
    expect(chatVisitor({ first_name: 'Laura', last_name: 'Biche' }, 'laura@example.com')).toEqual({ name: 'Laura Biche', email: 'laura@example.com' });
  });

  it('passes nothing for guests or when the name is unknown', () => {
    expect(chatVisitor(null, null)).toBeUndefined();
    expect(chatVisitor({ first_name: '', last_name: '' }, 'x@example.com')).toBeUndefined();
  });

  it('passes the name without an email when there is none', () => {
    expect(chatVisitor({ first_name: 'Bob', last_name: null }, null)).toEqual({ name: 'Bob' });
  });
});
