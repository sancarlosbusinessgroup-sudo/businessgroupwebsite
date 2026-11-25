'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { ACTIVITY_KINDS, activitySignature, DEBOUNCE_MS, isEditing, needsRefresh, pollDelayMs, type ActivityKind } from '@/lib/live-activity';

export type LiveStatus = 'connecting' | 'live' | 'polling';

type Options = {
  /** Activity total the page was rendered with (getActivityVersion on the server). */
  version: number | null;
  /** Reloads the page's data (router.refresh, keeping client state such as the current slide). */
  refresh: () => void;
  kinds?: readonly ActivityKind[];
  /**
   * 'defer' (pages): a hidden tab reloads when it is shown again. 'refresh' (slides): reload anyway, because a deck shared
   * on Zoom can count as hidden behind other windows.
   */
  whenHidden?: 'defer' | 'refresh';
  /** Wait while the member is typing in a form field (pages). The slides have nothing to type into. */
  pauseWhileEditing?: boolean;
};

/**
 * Live updates for member activity (owner, 2026-11-25). Listens to public.activity_versions through Supabase Realtime and
 * also checks it every few seconds (often while Realtime is not connected, e.g. on networks that block websockets, and
 * on the local test stack), when the tab is shown again and when the device comes back online. When the total for the
 * page's kinds goes past what the page was rendered with, the page reloads its data from the server.
 */
export function useLiveActivity({ version, refresh, kinds = ACTIVITY_KINDS, whenHidden = 'defer', pauseWhileEditing = true }: Options) {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Latest values for the long-lived listeners below, without re-subscribing on every render.
  const rendered = useRef(version);
  const requested = useRef(version ?? 0);
  const refreshRef = useRef(refresh);
  const opts = useRef({ kinds, whenHidden, pauseWhileEditing });
  useEffect(() => {
    rendered.current = version;
    if (version !== null && version > requested.current) requested.current = version;
  }, [version]);
  useEffect(() => {
    refreshRef.current = refresh;
    opts.current = { kinds, whenHidden, pauseWhileEditing };
  });

  const kindsKey = kinds.join(',');
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    let stopped = false;
    let realtime = false;
    let pending = false;
    let checking = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const hidden = () => document.visibilityState === 'hidden';

    // Reload now, or as soon as the tab is visible / the member leaves the field they're typing in.
    const flush = () => {
      if (stopped || !pending) return;
      const o = opts.current;
      if (o.whenHidden === 'defer' && hidden()) return;
      if (o.pauseWhileEditing && isEditing(document.activeElement)) return;
      pending = false;
      setUpdatedAt(new Date());
      refreshRef.current();
    };

    const check = async () => {
      if (stopped || checking) return;
      checking = true;
      try {
        const { data, error } = await supabase.from('activity_versions').select('kind, version');
        if (stopped || error || !data) return;
        const seen = activitySignature(data, opts.current.kinds);
        if (needsRefresh(seen, rendered.current, requested.current)) {
          requested.current = seen;
          pending = true;
          flush();
        }
      } finally {
        checking = false;
      }
    };
    const checkSoon = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void check(), DEBOUNCE_MS);
    };

    const poll = () => {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(async () => {
        if (!(opts.current.whenHidden === 'defer' && hidden())) await check();
        if (!stopped) poll();
      }, pollDelayMs(realtime));
    };

    const watched = new Set(kindsKey.split(','));
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const subscribe = async () => {
      // Join with the member's session (not the public key), so Realtime's row security lets the changes through.
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (stopped) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token).catch(() => undefined);
      if (stopped) return;
      channel = supabase
        .channel(`live-activity-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_versions' }, (payload) => {
          const kind = (payload.new as { kind?: string } | null)?.kind;
          if (!kind || watched.has(kind)) checkSoon();
        })
        .subscribe((s) => {
          if (stopped) return;
          realtime = s === 'SUBSCRIBED';
          setStatus(realtime ? 'live' : 'polling');
          // (Re)connected: catch up on anything missed while the connection was down.
          if (realtime) checkSoon();
          poll();
        });
    };
    void subscribe();

    const onVisible = () => {
      if (hidden()) return;
      flush();
      checkSoon();
    };
    const onFocusOut = () => setTimeout(flush, 0);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', checkSoon);
    window.addEventListener('focus', onVisible);
    document.addEventListener('focusout', onFocusOut);

    // In case Realtime never answers, start the safety-net polling and an early check now.
    poll();
    checkSoon();

    return () => {
      stopped = true;
      clearTimeout(pollTimer);
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', checkSoon);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('focusout', onFocusOut);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [kindsKey]);

  return { status, updatedAt };
}
