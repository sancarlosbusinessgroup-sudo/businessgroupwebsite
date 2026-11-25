'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import type { ActivityKind } from '@/lib/live-activity';
import { useLiveActivity } from './useLiveActivity';

/**
 * Drop-in for server-rendered pages (Member Activity, Member Stats, the dashboard leaderboard, the report pages): when
 * a member anywhere files, edits or deletes activity, the page reloads its data from the server without a page reload.
 * Forms keep what's typed in them. Renders only a hidden marker (used by the tests), so the design is unchanged.
 */
export function LiveRefresh({ version, kinds }: { version: number | null; kinds?: readonly ActivityKind[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  const { status } = useLiveActivity({ version, refresh, kinds });
  return <span hidden data-live-activity={status} data-live-version={version ?? ''} />;
}
