// Browser-side helpers for the Tidio widget. See ./chat.ts for configuration.
//
// Phones (owner, 2026-10-24): Tidio's floating bubble is not shown; the round chat button on the phone bar (and the
// "Chat with support" button) open the chat instead. Tidio's hide() takes the WHOLE widget off the page, including the
// chat window, so opening the chat must always call show() first. On phones the widget is hidden again once the
// visitor closes the chat window (LiveChat listens for Tidio's open/close events).

export type TidioApi = {
  open?: () => void;
  close?: () => void;
  hide?: () => void;
  show?: () => void;
  getStatus?: () => 'online' | 'offline' | null;
  on?: (event: string, handler: () => void) => void;
};

type TidioWindow = Window & { tidioChatApi?: TidioApi };

export function tidioApi(): TidioApi | undefined {
  return (window as TidioWindow).tidioChatApi;
}

/** Phone-width screens (the breakpoint where the layout switches to the phone bar, below md). */
export const PHONE_QUERY = '(max-width: 767.98px)';

export function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches === true;
}

let chatOpen = false;

/** Kept in step with Tidio's open/close events (see LiveChat). */
export function setChatOpen(open: boolean) {
  chatOpen = open;
}

/**
 * Whether the Tidio widget belongs on the page: never on the meeting slides; on computers always (the bubble);
 * on phones only while the chat window is open.
 */
export function widgetVisible(onSlides: boolean): boolean {
  if (onSlides) return false;
  return !isPhone() || chatOpen;
}

/** Tidio has finished loading once it reports a status ('online' or 'offline'). */
function ready(api: TidioApi | undefined): api is TidioApi & { open: () => void } {
  return typeof api?.open === 'function' && typeof api.getStatus === 'function' && api.getStatus() !== null;
}

/**
 * Opens the chat window. If the widget is still loading, waits up to `timeoutMs`.
 * Resolves false when it never became ready (blocked by an ad blocker, offline, …).
 */
export function openLiveChat(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const attempt = () => {
      const api = tidioApi();
      if (ready(api)) {
        // Mark open before show() so nothing hides the widget again in between (LiveChat re-hides it on close).
        chatOpen = true;
        api.show?.();
        api.open();
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(attempt, 200);
    };
    attempt();
  });
}
