'use client';

// Live attendance (owner, 2026-11-10): who has joined the Zoom meeting, updated every few seconds while the meeting
// runs. Management Team (admins) only. Late = joined after 8:30 AM. The after-meeting report stays the official record.

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { SubmitButton } from '@/components/forms';
import { Pill } from '@/components/ui';
import { idle } from '@/lib/validation';
import type { LivePerson, LiveSummary } from '@/lib/zoom-live';
import { linkLiveName } from '../../actions/attendance';

const POLL_MS = 10_000;

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

function Person({ p, late }: { p: LivePerson; late?: boolean }) {
  return (
    <li className="border-line-soft flex flex-wrap items-baseline gap-x-2 border-b py-2 last:border-b-0">
      <strong className="text-heading">{p.name}</strong>
      <span className="text-ink-muted text-sm">joined {time(p.joinedAt)}</span>
      {late ? <Pill tone="amber">{p.minutesLate} min late</Pill> : null}
      {!p.inNow && p.leftAt ? <Pill tone="gray">Left {time(p.leftAt)}</Pill> : null}
      {p.zoomName !== p.name ? <span className="text-ink-muted text-sm">on Zoom as “{p.zoomName}”</span> : null}
    </li>
  );
}

function Group({ id, title, count, children, empty }: { id: string; title: string; count: number; children: React.ReactNode; empty: string }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h3 id={id} className="font-display text-heading m-0 text-lg font-extrabold">
        {title} ({count})
      </h3>
      {count ? <ul className="m-0 list-none p-0">{children}</ul> : <p className="text-ink-muted m-0 text-sm">{empty}</p>}
    </section>
  );
}

function LinkUnknown({ p, members, onLinked }: { p: LivePerson; members: { id: string; name: string }[]; onLinked: () => void }) {
  const [state, action] = useActionState(linkLiveName, idle);
  const done = useRef<unknown>(null);
  useEffect(() => {
    if (state.status === 'success' && done.current !== state) {
      done.current = state;
      onLinked();
    }
  }, [state, onLinked]);
  const fid = `live-${p.key}`;
  return (
    <li className="border-line-soft flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <strong className="text-heading">{p.zoomName}</strong>
        <span className="text-ink-muted text-sm">joined {time(p.joinedAt)}</span>
        {!p.inNow && p.leftAt ? <Pill tone="gray">Left {time(p.leftAt)}</Pill> : null}
      </div>
      <form action={action} className="flex flex-wrap items-end gap-3" aria-label={`Who is ${p.zoomName}?`}>
        <input type="hidden" name="key" value={p.key} />
        <div className="w-64 max-w-full">
          <label className="label" htmlFor={fid}>
            This is
          </label>
          <select id={fid} name="profileId" className="field" defaultValue="">
            <option value="">Choose a member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pendingText="Linking…" className="btn btn-primary btn-sm">
          Link to member
        </SubmitButton>
      </form>
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-red m-0 text-sm font-semibold">
          {state.message}
        </p>
      ) : null}
    </li>
  );
}

export function LiveAttendance({
  meetingId,
  initial,
  members,
  live,
}: {
  meetingId: string;
  initial: LiveSummary;
  members: { id: string; name: string }[];
  /** The meeting is on now (an hour before to an hour after): keep refreshing. */
  live: boolean;
}) {
  const [data, setData] = useState(initial);
  const [updated, setUpdated] = useState(() => new Date());
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/live-attendance?m=${meetingId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as LiveSummary);
      setUpdated(new Date());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [meetingId]);

  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [live, refresh]);

  const here = data.onTime.length + data.late.length;
  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="live-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="live-h" className="font-display m-0 text-xl font-extrabold">
          Live attendance
        </h2>
        <p className="text-ink-muted m-0 text-sm" role="status">
          {here} of {here + data.notYet.length} members joined
          {live
            ? ` · updated ${updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/Los_Angeles' })}`
            : ''}
        </p>
      </div>
      <p className="text-ink-muted m-0 text-sm">
        Straight from Zoom as people join and leave{live ? ', refreshed every 10 seconds' : ''}. Late means joining after 8:30 AM. Only the Management Team sees
        this. Visitors who aren’t on the guest list show under unknown names; sort them out after the meeting. The Zoom report fetched after the meeting is
        still the official attendance.
      </p>
      {failed ? <p className="text-red m-0 text-sm font-semibold">Couldn’t refresh just now. Trying again…</p> : null}
      {!data.events ? (
        <p className="m-0 font-semibold">{live ? 'Nobody has joined the Zoom meeting yet.' : 'No live data was received from Zoom for this meeting.'}</p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Group id="live-late" title="Late" count={data.late.length} empty="Nobody late.">
          {data.late.map((p) => (
            <Person key={p.key} p={p} late />
          ))}
        </Group>
        <Group id="live-ontime" title="On time" count={data.onTime.length} empty="Nobody yet.">
          {data.onTime.map((p) => (
            <Person key={p.key} p={p} />
          ))}
        </Group>
        <section aria-labelledby="live-notyet" className="flex min-w-0 flex-col gap-2">
          <h3 id="live-notyet" className="font-display text-heading m-0 text-lg font-extrabold">
            Not here yet ({data.notYet.length})
          </h3>
          {data.notYet.length ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {data.notYet.map((m) => (
                <li key={m.id} className="bg-line-soft rounded-full px-3 py-1 text-sm">
                  {m.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted m-0 text-sm">Every member has joined.</p>
          )}
        </section>
        <div className="flex flex-col gap-6">
          {data.unknown.length ? (
            <Group id="live-unknown" title="Unknown Zoom names" count={data.unknown.length} empty="">
              {data.unknown.map((p) => (
                <LinkUnknown key={p.key} p={p} members={members} onLinked={refresh} />
              ))}
            </Group>
          ) : null}
          {data.visitors.length ? (
            <Group id="live-visitors" title="Invited guests" count={data.visitors.length} empty="">
              {data.visitors.map((p) => (
                <Person key={p.key} p={p} />
              ))}
            </Group>
          ) : null}
        </div>
      </div>
    </section>
  );
}
