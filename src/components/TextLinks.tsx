import type { ReactNode } from 'react';
import { mapsUrl, splitLinks } from '@/lib/text-links';

// Owner request 2026-11-09: clickable web addresses in event text, and venue addresses that open Google Maps.
// Both open in a new tab and say so for screen readers.

const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

/** Free text with any web address in it turned into a link. Line breaks are kept by the parent's `whitespace-pre-line`. */
export function Linkify({ text, className }: { text: string; className?: string }) {
  const parts = splitLinks(text);
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'link' ? (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={className ?? 'font-semibold break-all'}
            data-testid="text-link"
          >
            {p.value}
            {NEW_TAB}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

/** An in-person venue address as a Google Maps link with a map-pin icon. */
export function VenueLink({ address, className = '', children }: { address: string; className?: string; children?: ReactNode }) {
  return (
    <a
      href={mapsUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-baseline gap-1 ${className}`}
      title="Open in Google Maps"
      data-testid="venue-link"
    >
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="relative top-[0.12em] flex-none"
      >
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span>{children ?? address}</span>
      <span className="sr-only"> (opens Google Maps in a new tab)</span>
    </a>
  );
}
