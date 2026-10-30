'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/**
 * "Add BARP to your phone" (owner, 2026-10-30): on Chrome/Android (and desktop Chrome/Edge) a real install button; on
 * iPhone/iPad the two Safari steps. Hidden once the site is already running as an installed app.
 */
export function InstallAppCard() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installedNow, setInstalledNow] = useState(false);
  // 'unknown' while rendering on the server, so the card never flashes for installed users.
  const detected = useSyncExternalStore(
    () => () => {},
    () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
      if (standalone) return 'installed' as const;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return ios ? ('ios' as const) : ('other' as const);
    },
    () => 'unknown' as const,
  );
  const state = installedNow ? 'installed' : detected;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const onInstalled = () => setInstalledNow(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (state === 'unknown' || state === 'installed') return null;

  return (
    <section className="card flex flex-col gap-2.5 p-5" aria-labelledby="install-h">
      <h2 id="install-h" className="font-display m-0 text-lg">
        Add BARP to your phone
      </h2>
      <p className="text-ink-muted m-0 text-[15px]">
        Get a BARP icon on your home screen that opens full screen, with shortcuts to report a referral or a one-on-one.
      </p>
      {state === 'ios' ? (
        <ol className="text-ink-soft m-0 flex list-decimal flex-col gap-1 pl-5 text-[15px]">
          <li>
            In Safari, tap the <strong>Share</strong> button (the square with an arrow).
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
        </ol>
      ) : prompt ? (
        <button
          type="button"
          className="btn btn-primary btn-sm self-start"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === 'accepted') setInstalledNow(true);
            setPrompt(null);
          }}
        >
          Install the app
        </button>
      ) : (
        <p className="text-ink-soft m-0 text-[15px]">
          In Chrome, open the browser menu (⋮) and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.
        </p>
      )}
    </section>
  );
}
