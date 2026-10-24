import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { LiveChat } from './LiveChat';

type TidioDoc = Document & { tidioIdentify?: Record<string, string> };
type TidioWindow = Window & { tidioChatApi?: Record<string, unknown> };
const KEY = 'tmit8jukbkhwergbpcrj6d7lrpfbghix';
const tidioScripts = () => Array.from(document.querySelectorAll('script')).filter((s) => s.src.startsWith('https://code.tidio.co/'));

afterEach(() => {
  tidioScripts().forEach((s) => s.remove());
  delete (document as TidioDoc).tidioIdentify;
  delete (window as TidioWindow).tidioChatApi;
  pathname = '/';
});

describe('LiveChat', () => {
  it('loads the Tidio widget once with the configured key', () => {
    const { rerender } = render(<LiveChat publicKey={KEY} />);
    rerender(<LiveChat publicKey={KEY} />);
    const scripts = tidioScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(`https://code.tidio.co/${KEY}.js`);
    expect(scripts[0]?.async).toBe(true);
  });

  it('fills in a signed-in member’s name and email before the widget loads', () => {
    render(<LiveChat publicKey={KEY} visitor={{ id: 'u-1', name: 'Laura Biche', email: 'laura@example.com' }} />);
    expect((document as TidioDoc).tidioIdentify).toEqual({ distinct_id: 'u-1', name: 'Laura Biche', email: 'laura@example.com' });
  });

  it('identifies nobody for guests', () => {
    render(<LiveChat publicKey={KEY} />);
    expect((document as TidioDoc).tidioIdentify).toBeUndefined();
  });

  it('does not load on the meeting slides', () => {
    pathname = '/present/next';
    render(<LiveChat publicKey={KEY} />);
    expect(tidioScripts()).toHaveLength(0);
  });

  it('hides the bubble when moving to the slides and shows it again after', () => {
    const hide = vi.fn();
    const show = vi.fn();
    const { rerender } = render(<LiveChat publicKey={KEY} />);
    (window as TidioWindow).tidioChatApi = { hide, show, on: vi.fn() };
    pathname = '/present/next';
    rerender(<LiveChat publicKey={KEY} />);
    expect(hide).toHaveBeenCalled();
    pathname = '/support';
    rerender(<LiveChat publicKey={KEY} />);
    expect(show).toHaveBeenCalled();
  });
  it('keeps the floating bubble hidden on phones (the bar chat button opens the chat there)', () => {
    const hide = vi.fn();
    const show = vi.fn();
    const original = window.matchMedia;
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    try {
      (window as TidioWindow).tidioChatApi = { hide, show, on: vi.fn() };
      render(<LiveChat publicKey={KEY} />);
      pathname = '/support';
      expect(hide).toHaveBeenCalled();
      expect(show).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = original;
    }
  });
});
