import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { LiveChat } from './LiveChat';

type TawkWindow = Window & { Tawk_API?: Record<string, unknown> };
const ids = { propertyId: '64f1a2b3c4d5e6f708192a3b', widgetId: '1h9abc2de' };
const tawkScripts = () => Array.from(document.querySelectorAll('script')).filter((s) => s.src.startsWith('https://embed.tawk.to/'));

afterEach(() => {
  tawkScripts().forEach((s) => s.remove());
  delete (window as TawkWindow).Tawk_API;
  pathname = '/';
});

describe('LiveChat', () => {
  it('loads the tawk.to widget once with the configured IDs', () => {
    const { rerender } = render(<LiveChat {...ids} />);
    rerender(<LiveChat {...ids} />);
    const scripts = tawkScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe('https://embed.tawk.to/64f1a2b3c4d5e6f708192a3b/1h9abc2de');
    expect(scripts[0]?.async).toBe(true);
  });

  it('fills in a signed-in member’s name and email', () => {
    render(<LiveChat {...ids} visitor={{ name: 'Laura Biche', email: 'laura@example.com' }} />);
    expect((window as TawkWindow).Tawk_API?.visitor).toEqual({ name: 'Laura Biche', email: 'laura@example.com' });
  });

  it('does not load on the meeting slides', () => {
    pathname = '/present/next';
    render(<LiveChat {...ids} />);
    expect(tawkScripts()).toHaveLength(0);
  });

  it('hides the bubble when moving to the slides and shows it again after', () => {
    const hideWidget = vi.fn();
    const showWidget = vi.fn();
    const { rerender } = render(<LiveChat {...ids} />);
    Object.assign((window as TawkWindow).Tawk_API!, { hideWidget, showWidget });
    pathname = '/present/next';
    rerender(<LiveChat {...ids} />);
    expect(hideWidget).toHaveBeenCalled();
    pathname = '/support';
    rerender(<LiveChat {...ids} />);
    expect(showWidget).toHaveBeenCalled();
  });
});
