// Browser-side helpers for the tawk.to widget. See ./chat.ts for configuration.

export type TawkApi = {
  visitor?: { name: string; email?: string };
  onLoad?: () => void;
  maximize?: () => void;
  hideWidget?: () => void;
  showWidget?: () => void;
  [key: string]: unknown;
};

type TawkWindow = Window & { Tawk_API?: TawkApi; Tawk_LoadStart?: Date };

export function tawkApi(): TawkApi {
  const w = window as TawkWindow;
  w.Tawk_API = w.Tawk_API || {};
  return w.Tawk_API;
}

export function markTawkLoadStart() {
  (window as TawkWindow).Tawk_LoadStart = new Date();
}

/**
 * Opens the chat window. If the widget is still loading, waits up to `timeoutMs`.
 * Resolves false when it never became ready (blocked by an ad blocker, offline, …).
 */
export function openLiveChat(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const attempt = () => {
      const api = (window as TawkWindow).Tawk_API;
      if (typeof api?.maximize === 'function') {
        api.maximize();
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
