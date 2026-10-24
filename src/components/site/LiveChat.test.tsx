import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { openLiveChat, setChatOpen } from '@/lib/chat-client';
import { LiveChat } from './LiveChat';

type TidioDoc = Document & { tidioIdentify?: Record<string, string> };
type TidioWindow = Window & { tidioChatApi?: Record<string, unknown> };
const KEY = 'tmit8jukbkhwergbpcrj6d7lrpfbghix';
const tidioScripts = () => Array.from(document.querySelectorAll('script')).filter((s) => s.src.startsWith('https://code.tidio.co/'));

afterEach(() => {
  tidioScripts().forEach((s) => s.remove());
  delete (document as TidioDoc).tidioIdentify;
  delete (window as TidioWindow).tidioChatApi;
  setChatOpen(false);
  pathname = '/';
});

/** Pretend the screen is phone-sized (jsdom has no matchMedia). Returns a function that undoes it. */
function asPhone() {
  const original = window.matchMedia;
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

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
    const undo = asPhone();
    try {
      (window as TidioWindow).tidioChatApi = { hide, show, on: vi.fn() };
      render(<LiveChat publicKey={KEY} />);
      expect(hide).toHaveBeenCalled();
      expect(show).not.toHaveBeenCalled();
    } finally {
      undo();
    }
  });

  it('on phones, opening the chat puts the widget back first (hide() removes the chat window too), and closing it hides it again', async () => {
    const handlers: Record<string, () => void> = {};
    const hide = vi.fn();
    const show = vi.fn();
    const open = vi.fn();
    const undo = asPhone();
    try {
      render(<LiveChat publicKey={KEY} />);
      (window as TidioWindow).tidioChatApi = {
        hide,
        show,
        open,
        getStatus: () => 'online',
        on: (event: string, fn: () => void) => {
          handlers[event] = fn;
        },
      };
      document.dispatchEvent(new Event('tidioChat-ready'));
      expect(hide).toHaveBeenCalled();
      hide.mockClear();

      expect(await openLiveChat()).toBe(true);
      expect(show).toHaveBeenCalled();
      expect(open).toHaveBeenCalled();
      expect(show.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0] ?? 0);
      handlers.open?.();
      expect(hide).not.toHaveBeenCalled();

      handlers.close?.();
      expect(hide).toHaveBeenCalled();
    } finally {
      undo();
    }
  });
});
