'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { chatHiddenOn, tidioScriptUrl, type ChatVisitor } from '@/lib/chat';
import { tidioApi } from '@/lib/chat-client';

type Props = { publicKey: string; visitor?: ChatVisitor };
type TidioDoc = Document & { tidioIdentify?: { distinct_id: string; name: string; email?: string } };

/**
 * Loads the Tidio chat bubble (bottom corner of every page except the meeting slides).
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
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.onload = () => {
      tidioApi()?.on?.('ready', () => {
        if (hiddenRef.current) tidioApi()?.hide?.();
      });
    };
    document.body.appendChild(script);
  }, [hidden, publicKey, visitor]);

  // Hide the bubble on the slides, show it again elsewhere.
  useEffect(() => {
    const api = tidioApi();
    if (hidden) api?.hide?.();
    else api?.show?.();
  }, [hidden]);

  return null;
}
