'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { chatHiddenOn, tawkEmbedUrl, type ChatVisitor } from '@/lib/chat';
import { markTawkLoadStart, tawkApi } from '@/lib/chat-client';

type Props = { propertyId: string; widgetId: string; visitor?: ChatVisitor };

/**
 * Loads the tawk.to chat bubble (bottom corner of every page except the meeting slides).
 * Signed-in members' name and email are filled in so the support team knows who is asking.
 */
export function LiveChat({ propertyId, widgetId, visitor }: Props) {
  const pathname = usePathname();
  const hidden = chatHiddenOn(pathname);
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  // Load the widget the first time a page that shows it is opened.
  useEffect(() => {
    if (hidden) return;
    const src = tawkEmbedUrl({ propertyId, widgetId });
    if (document.querySelector(`script[src="${src}"]`)) return;
    const api = tawkApi();
    if (visitor) api.visitor = visitor;
    api.onLoad = () => {
      if (hiddenRef.current) tawkApi().hideWidget?.();
    };
    markTawkLoadStart();
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    document.body.appendChild(script);
  }, [hidden, propertyId, widgetId, visitor]);

  // Hide the bubble on the slides, show it again elsewhere.
  useEffect(() => {
    const api = tawkApi();
    if (hidden) api.hideWidget?.();
    else api.showWidget?.();
  }, [hidden]);

  return null;
}
