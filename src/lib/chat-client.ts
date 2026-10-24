// Browser-side helpers for the Tidio widget. See ./chat.ts for configuration.

export type TidioApi = {
  open?: () => void;
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

/** Tidio has finished loading once it reports a status ('online' or 'offline'). */
function ready(api: TidioApi | undefined): api is TidioApi & { open: () => void } {
  return typeof api?.open === 'function' && typeof api.getStatus === 'function' && api.getStatus() !== null;
}

/**
 * Opens the chat window. If the widget is still loading, waits up to `timeoutMs`.
 * Resolves false when it never became ready (blocked by an ad blocker, offline, …).
 * On phones the floating bubble stays hidden (the round chat button on the phone bar opens the chat), so it is not shown again here.
 */
export function openLiveChat(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const attempt = () => {
      const api = tidioApi();
      if (ready(api)) {
        if (!isPhone()) api.show?.();
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
