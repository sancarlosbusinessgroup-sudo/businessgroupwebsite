'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/forms';
import { Pill } from '@/components/ui';
import { idle, type ActionState } from '@/lib/validation';
import { fetchFromZoom, resolveParticipant, saveAttendance } from '../../actions/attendance';

function Status({ state }: { state: ActionState }) {
  if (state.status === 'success')
    return (
      <p role="status" className="text-green-ink m-0 text-sm font-semibold">
        {state.message}
      </p>
    );
  if (state.status === 'error' && state.message)
    return (
      <p role="alert" className="text-red m-0 text-sm font-semibold">
        {state.message}
      </p>
    );
  return null;
}

export function FetchZoomButton({ meetingId, disabled, again }: { meetingId: string; disabled?: boolean; again?: boolean }) {
  const [state, action] = useActionState(fetchFromZoom, idle);
  return (
    <form action={action} className="flex flex-col gap-2" aria-label="Fetch attendance from Zoom">
      <input type="hidden" name="meetingId" value={meetingId} />
      {disabled ? (
        <button type="button" className="btn btn-primary btn-sm self-start" disabled aria-disabled>
          Fetch from Zoom
        </button>
      ) : (
        <SubmitButton pendingText="Fetching from Zoom…" className="btn btn-primary btn-sm self-start">
          {again ? 'Fetch from Zoom again' : 'Fetch from Zoom'}
        </SubmitButton>
      )}
      <Status state={state} />
    </form>
  );
}

export type ReviewItem = { id: string; name: string; email: string | null; minutes: number };
export type MemberOption = { id: string; name: string };

export function ReviewRow({ item, members }: { item: ReviewItem; members: MemberOption[] }) {
  const [state, action] = useActionState(resolveParticipant, idle);
  const fid = `who-${item.id}`;
  return (
    <li className="border-line-soft flex flex-col gap-3 border-b py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <strong className="text-heading">{item.name}</strong>
        {item.email ? <span className="text-ink-muted text-sm">{item.email}</span> : null}
        <span className="text-ink-muted text-sm">{item.minutes} min</span>
      </div>
      <form action={action} className="flex flex-wrap items-end gap-3" aria-label={`Sort out ${item.name}`}>
        <input type="hidden" name="id" value={item.id} />
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
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="remember" defaultChecked className="h-5 w-5" />
          Remember this Zoom name
        </label>
        <button type="submit" name="action" value="link" className="btn btn-primary btn-sm">
          Link to member
        </button>
        <button type="submit" name="action" value="visitor" className="btn btn-outline btn-sm">
          Visitor
        </button>
        <button type="submit" name="action" value="ignore" className="btn btn-outline btn-sm">
          Ignore
        </button>
      </form>
      <Status state={state} />
    </li>
  );
}

export type AttendanceRow = {
  id: string;
  name: string;
  choice: 'present' | 'substitute' | 'excused' | 'absent';
  zoom: string | null;
  late: boolean;
  leftEarly: boolean;
  missed: number;
  atLimit: boolean;
};

export function AttendanceTable({ meetingId, rows, limit }: { meetingId: string; rows: AttendanceRow[]; limit: number }) {
  const [state, action] = useActionState(saveAttendance, idle);
  return (
    <form action={action} aria-label="Attendance for this meeting" className="flex flex-col gap-4">
      <input type="hidden" name="meetingId" value={meetingId} />
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Attendance table">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-line border-b">
              <th scope="col" className="py-2 pr-3">
                Member
              </th>
              <th scope="col" className="py-2 pr-3">
                On Zoom
              </th>
              <th scope="col" className="py-2 pr-3">
                Missed (6 months)
              </th>
              <th scope="col" className="py-2">
                Attendance
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-line-soft border-b">
                <th scope="row" className="text-heading py-2 pr-3 font-semibold">
                  {r.name}
                </th>
                <td className="text-ink-muted py-2 pr-3">
                  {r.zoom ?? '—'}
                  {r.late ? (
                    <span className="ml-2">
                      <Pill tone="amber">Late</Pill>
                    </span>
                  ) : null}
                  {r.leftEarly ? (
                    <span className="ml-2">
                      <Pill tone="amber">Left early</Pill>
                    </span>
                  ) : null}
                </td>
                <td className={`py-2 pr-3 tabular-nums ${r.atLimit ? 'text-red font-bold' : ''}`}>
                  {r.missed} of {limit}
                </td>
                <td className="py-2">
                  <label className="sr-only" htmlFor={`s-${r.id}`}>
                    Attendance for {r.name}
                  </label>
                  {/* Keyed by the stored value so the select shows it again after saving or a Zoom fetch. */}
                  <select key={r.choice} id={`s-${r.id}`} name={`s_${r.id}`} defaultValue={r.choice} className="field min-h-11 py-1">
                    <option value="present">Present</option>
                    <option value="substitute">Sent a substitute</option>
                    <option value="excused">Excused (told a leader)</option>
                    <option value="absent">Absent</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…" className="btn btn-primary">
          Save attendance
        </SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}
