'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { chatHiddenOn, tidioScriptUrl, type ChatVisitor } from '@/lib/chat';
import { PHONE_QUERY, setChatOpen, tidioApi, widgetVisible } from '@/lib/chat-client';

type Props = { publicKey: string; visitor?: ChatVisitor };
type TidioDoc = Document & { tidioIdentify?: { distinct_id: string; name: string; email?: string } };

/**
 * Loads the Tidio chat. On computers the bubble sits in the bottom corner of every page except the meeting slides.
 * On phones the widget stays off the page until the visitor opens the chat with the round button on the phone bar
 * (or "Chat with support"), and goes away again when they close it (owner, 2026-10-24).
 * Signed-in members' name and email are filled in so the support team knows who is asking.
 */
export function LiveChat({ publicKey, visitor }: Props) {
  const pathname = usePathname();
  const hidden = chatHiddenOn(pathname);
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  // Load the widget the first time a page that shows it is opened.
  useEffect(() => {
    if (hidden) return;
    const src = tidioScriptUrl({ publicKey });
    if (document.querySelector(`script[src="${src}"]`)) return;
    // Tidio reads this when it starts, so it must be set before the script runs.
    if (visitor) {
      (document as TidioDoc).tidioIdentify = {
        distinct_id: visitor.id,
        name: visitor.name,
        ...(visitor.email ? { email: visitor.email } : {}),
      };
    }

    // Once Tidio is ready: follow the chat window opening and closing, and show or hide the widget for this page and
    // screen. Tidio announces readiness with the document event 'tidioChat-ready' (or its own 'ready' event when the
    // API object already exists); either may arrive first, so wire up only once.
    let wired = false;
    const onReady = () => {
      const api = tidioApi();
      if (wired || !api) return;
      wired = true;
      api.on?.('open', () => {
        setChatOpen(true);
        applyVisibility(hiddenRef.current);
      });
      api.on?.('close', () => {
        setChatOpen(false);
        applyVisibility(hiddenRef.current);
      });
      applyVisibility(hiddenRef.current);
    };
    document.addEventListener('tidioChat-ready', onReady);
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.onload = () => {
      tidioApi()?.on?.('ready', onReady);
    };
    document.body.appendChild(script);
  }, [hidden, publicKey, visitor]);

  // Hide the widget on the slides and (while the chat is closed) on phones; show it elsewhere. Also when the screen
  // is resized across the phone width.
  useEffect(() => {
    const sync = () => applyVisibility(hidden);
    sync();
    const query = window.matchMedia?.(PHONE_QUERY);
    query?.addEventListener('change', sync);
    return () => query?.removeEventListener('change', sync);
  }, [hidden]);

  return null;
}

function applyVisibility(onSlides: boolean) {
  const api = tidioApi();
  if (widgetVisible(onSlides)) api?.show?.();
  else api?.hide?.();
}
