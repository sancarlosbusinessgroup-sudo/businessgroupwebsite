'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useTransition, type ReactNode } from 'react';
import type { ActivityKind } from '@/lib/live-activity';
import { LiveScope } from './LiveNumber';
import { useLiveActivity } from './useLiveActivity';

/**
 * Drop-in for server-rendered pages (Member Activity, Member Stats, the dashboard, the Leaderboard page, the report pages):
 * when a member anywhere files, edits or deletes activity, the page reloads its data from the server without a page
 * reload. Forms keep what's typed in them. Content passed as children gets the teal highlight on numbers that change
 * (LiveNumber) and the "Live · updated …" line (LiveStatus) (owner, 2026-11-26).
 */
export function LiveRefresh({ version, kinds, children }: { version: number | null; kinds?: readonly ActivityKind[]; children?: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  const { status, updatedAt } = useLiveActivity({ version, refresh, kinds });
  const marker = <span hidden data-live-activity={status} data-live-version={version ?? ''} />;
  if (!children) return marker;
  return (
    <LiveScope version={version} updatedAt={updatedAt}>
      {marker}
      {children}
    </LiveScope>
  );
}
