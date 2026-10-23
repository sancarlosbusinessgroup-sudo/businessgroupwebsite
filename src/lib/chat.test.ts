import { describe, expect, it } from 'vitest';
import { chatHiddenOn, chatVisitor, tidioConfig, tidioScriptUrl } from './chat';

const KEY = 'tmit8jukbkhwergbpcrj6d7lrpfbghix';

describe('tidioConfig', () => {
  it('returns the public key when it is set and well-formed', () => {
    expect(tidioConfig(KEY)).toEqual({ publicKey: KEY });
  });

  it('trims spaces pasted with the key', () => {
    expect(tidioConfig(`  ${KEY} `)).toEqual({ publicKey: KEY });
  });

  it('accepts the whole embed address or script tag pasted by mistake', () => {
    expect(tidioConfig(`//code.tidio.co/${KEY}.js`)).toEqual({ publicKey: KEY });
    expect(tidioConfig(`<script src="//code.tidio.co/${KEY}.js" async></script>`)).toEqual({ publicKey: KEY });
  });

  it('is off (null) when the key is missing', () => {
    expect(tidioConfig(undefined)).toBeNull();
    expect(tidioConfig('')).toBeNull();
  });

  it('is off (null) when the key is malformed, so nothing odd ends up in the script address', () => {
    expect(tidioConfig('short')).toBeNull();
    expect(tidioConfig('../evil/tmit8jukbkhwergbpcrj6d7lrpfbghix')).toBeNull();
    expect(tidioConfig('TMIT8JUKBKHWERGBPCRJ6D7LRPFBGHIX!')).toBeNull();
  });
});

describe('tidioScriptUrl', () => {
  it('builds the Tidio script address', () => {
    expect(tidioScriptUrl({ publicKey: KEY })).toBe(`https://code.tidio.co/${KEY}.js`);
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
  it('passes a signed-in member’s id, name and email to the chat', () => {
    expect(chatVisitor('u-1', { first_name: 'Laura', last_name: 'Biche' }, 'laura@example.com')).toEqual({
      id: 'u-1',
      name: 'Laura Biche',
      email: 'laura@example.com',
    });
  });

  it('passes nothing for guests or when the name is unknown', () => {
    expect(chatVisitor(null, null, null)).toBeUndefined();
    expect(chatVisitor('u-1', { first_name: '', last_name: '' }, 'x@example.com')).toBeUndefined();
  });

  it('passes the name without an email when there is none', () => {
    expect(chatVisitor('u-2', { first_name: 'Bob', last_name: null }, null)).toEqual({ id: 'u-2', name: 'Bob' });
  });
});
