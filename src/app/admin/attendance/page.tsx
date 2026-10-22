import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { EmptyState, Notice } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { absencesFor, memberSince } from '@/lib/data/attendance';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { ABSENCE_LIMIT, lateEarly, parseZoomMeetingId } from '@/lib/zoom';
import { zoomConfigured } from '@/lib/zoom-api';
import { AttendanceTable, FetchZoomButton, ReviewRow, type AttendanceRow } from './AttendanceForms';

export const metadata: Metadata = { title: 'Attendance' };

const timeOf = (iso: string | null) => (iso ? formatMeetingTime(new Date(iso)) : null);

export default async function AdminAttendancePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireAdmin();
  const { m } = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const [meetingsRes, membersRes] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, starts_at, ends_at, cancelled_reason')
      .eq('category', 'Networking')
      .lte('starts_at', now.toISOString())
      .order('starts_at', { ascending: false })
      .limit(26),
    supabase
      .from('profiles')
      .select('id, first_name, last_name, approved_at, member_since, created_at')
      .eq('status', 'approved')
      .order('first_name')
      .order('last_name'),
  ]);
  if (meetingsRes.error || membersRes.error) throw new Error('Could not load attendance');
  const meetings = meetingsRes.data ?? [];
  const members = membersRes.data ?? [];
  const meeting = meetings.find((x) => x.id === m) ?? meetings.find((x) => !x.cancelled_reason) ?? meetings[0];
  const absences = await absencesFor(
    supabase,
    members.map((p) => ({ id: p.id, since: memberSince(p) })),
    now,
  );
  const alerts = members.filter((p) => absences.get(p.id)?.atLimit);
  const connected = zoomConfigured();

  let body = <EmptyState title="No meetings yet">Attendance appears here after the first meeting.</EmptyState>;
  if (meeting) {
    const [impRes, partRes, attRes, linkRes] = await Promise.all([
      supabase.from('attendance_imports').select('*').eq('meeting_id', meeting.id).maybeSingle(),
      supabase.from('zoom_participants').select('id, name, email, minutes, resolution').eq('meeting_id', meeting.id).order('name'),
      supabase.from('attendance').select('profile_id, status, substitute, zoom, joined_at, left_at, minutes').eq('meeting_id', meeting.id),
      supabase.from('meeting_links').select('join_url').eq('meeting_id', meeting.id).maybeSingle(),
    ]);
    const imp = impRes.data;
    const parts = partRes.data ?? [];
    const pending = parts.filter((p) => p.resolution === 'pending');
    const visitors = parts.filter((p) => p.resolution === 'visitor' || p.resolution === 'guest');
    const att = new Map((attRes.data ?? []).map((a) => [a.profile_id, a]));
    const hasZoomLink = !!parseZoomMeetingId(linkRes.data?.join_url);
    const rows: AttendanceRow[] = members.map((p) => {
      const a = att.get(p.id);
      const flags = a?.zoom ? lateEarly(meeting, a.joined_at, a.left_at) : { late: false, leftEarly: false };
      const sum = absences.get(p.id);
      return {
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        choice: !a ? 'absent' : a.substitute ? 'substitute' : a.status,
        zoom: a?.zoom ? `${timeOf(a.joined_at) ?? '?'}–${timeOf(a.left_at) ?? '?'} · ${a.minutes ?? 0} min` : null,
        late: flags.late,
        leftEarly: flags.leftEarly,
        missed: sum?.missed ?? 0,
        atLimit: !!sum?.atLimit,
      };
    });
    const present = rows.filter((r) => r.choice === 'present' || r.choice === 'substitute').length;

    body = (
      <>
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="zoom-h">
          <h2 id="zoom-h" className="font-display m-0 text-xl font-extrabold">
            {formatMeetingDate(new Date(meeting.starts_at))}
            {meeting.cancelled_reason ? <span className="text-red text-base"> · Cancelled</span> : null}
          </h2>
          <p className="text-ink-muted m-0">
            {imp?.status === 'done'
              ? `Attendance taken ${imp.source === 'zoom' ? 'from Zoom' : 'by hand'} on ${formatMeetingDate(new Date(imp.imported_at))}. ${present} of ${members.length} members present${imp.source === 'zoom' ? `, ${imp.participants} people in the Zoom report` : ''}.`
              : 'Attendance has not been taken for this meeting yet. It counts toward the absence limit once it is.'}
          </p>
          {imp?.error ? <Notice tone="error">Last Zoom attempt: {imp.error}</Notice> : null}
          {!connected ? (
            <Notice tone="info">
              Zoom isn’t connected yet, so attendance is taken by hand below. Once the group’s Zoom app is set up, the site fetches the participant list
              automatically around noon on meeting days.
            </Notice>
          ) : !hasZoomLink ? (
            <Notice tone="info">This meeting has no Zoom link saved, so the site can’t tell which Zoom meeting to read.</Notice>
          ) : null}
          <FetchZoomButton meetingId={meeting.id} disabled={!connected || !hasZoomLink} again={imp?.source === 'zoom' && imp.status === 'done'} />
        </section>

        {pending.length ? (
          <section className="card flex flex-col gap-2 p-5" aria-labelledby="review-h">
            <h2 id="review-h" className="font-display m-0 text-xl font-extrabold">
              Needs review ({pending.length})
            </h2>
            <p className="text-ink-muted m-0 text-sm">
              People in the Zoom report the site couldn’t match to a member or an invited guest. Link each one to a member, mark them as a visitor, or ignore
              them.
            </p>
            <ul className="m-0 list-none p-0">
              {pending.map((p) => (
                <ReviewRow key={p.id} item={p} members={members.map((x) => ({ id: x.id, name: `${x.first_name} ${x.last_name}` }))} />
              ))}
            </ul>
          </section>
        ) : null}

        {visitors.length ? (
          <section className="card flex flex-col gap-2 p-5" aria-labelledby="visitors-h">
            <h2 id="visitors-h" className="font-display m-0 text-xl font-extrabold">
              Visitors ({visitors.length})
            </h2>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {visitors.map((v) => (
                <li key={v.id} className="bg-line-soft rounded-full px-3 py-1 text-sm">
                  {v.name}
                  {v.resolution === 'guest' ? ' · invited guest (marked Visited)' : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="att-h">
          <h2 id="att-h" className="font-display m-0 text-xl font-extrabold">
            Members
          </h2>
          <p className="text-ink-muted m-0 text-sm">
            Change anyone’s attendance and save. “Sent a substitute” counts as present; “Excused” still counts as a missed meeting. Late means joining Zoom
            after 8:30 AM; left early means leaving before 9:30 AM.
          </p>
          <AttendanceTable meetingId={meeting.id} rows={rows} limit={ABSENCE_LIMIT} />
        </section>
      </>
    );
  }

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Attendance</h1>
        <AdminNav current="/admin/attendance" />

        {alerts.length ? (
          <section aria-labelledby="alerts-h" className="border-red bg-red-tint flex flex-col gap-2 rounded-2xl border p-5">
            <h2 id="alerts-h" className="font-display text-heading m-0 text-lg font-extrabold">
              At the absence limit
            </h2>
            <p className="m-0 text-sm">Members may miss {ABSENCE_LIMIT} meetings in 6 months (Bylaws). These members have reached that:</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {alerts.map((p) => (
                <li key={p.id} className="bg-surface rounded-full px-3 py-1 text-sm font-semibold">
                  {p.first_name} {p.last_name} · missed {absences.get(p.id)?.missed}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <form action="/admin/attendance" className="card flex flex-wrap items-end gap-3 p-5" aria-label="Choose a meeting">
          <div className="min-w-0 flex-[1_1_260px]">
            <label className="label" htmlFor="m">
              Meeting
            </label>
            <select id="m" name="m" className="field" defaultValue={meeting?.id}>
              {meetings.map((x) => (
                <option key={x.id} value={x.id}>
                  {formatMeetingDate(new Date(x.starts_at))}
                  {x.cancelled_reason ? ' (cancelled)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-outline">
            Show
          </button>
        </form>

        {body}
      </div>
    </div>
  );
}
