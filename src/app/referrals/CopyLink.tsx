'use client';

import { useState } from 'react';

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <output className="bg-band-2 min-w-0 flex-[1_1_280px] rounded-xl px-4 py-3 font-mono text-base break-all" aria-label="Your invite link">
        {url}
      </output>
      <button
        type="button"
        className="btn btn-light"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? '✓ Copied' : 'Copy link'}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  );
}
