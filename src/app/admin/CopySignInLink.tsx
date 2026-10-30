'use client';

import { useState } from 'react';

/** Admin → Overview: the visitor sign-in link, with a Copy button, to paste in the Zoom chat. */
export function CopySignInLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <output
        className="bg-canvas border-line min-w-0 flex-[1_1_280px] rounded-xl border px-4 py-3 font-mono text-[15px] break-all"
        aria-label="Visitor sign-in link"
      >
        {url}
      </output>
      <button
        type="button"
        className="btn btn-primary"
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
      <a className="btn btn-outline" href={url} target="_blank" rel="noopener noreferrer">
        Open<span className="sr-only"> the visitor sign-in page (new tab)</span>
      </a>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  );
}
