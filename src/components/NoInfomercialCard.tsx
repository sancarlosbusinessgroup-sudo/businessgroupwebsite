import Link from 'next/link';
import type { NoInfomercialList } from '@/lib/data/no-infomercial';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';

/**
 * "No 60-second infomercial" list for whoever runs the slides (owner, 2026-11-24): members who left the previous
 * meeting early, so they skip their infomercial at this one. On the admin Overview and on Customize slides, with a
 * PDF to print or keep at hand.
 */
export function NoInfomercialCard({ list }: { list: NoInfomercialList }) {
  if (!list.meeting) return null;
  const pdf = `/api/admin/no-infomercial?meeting=${list.meeting.id}`;
  const when = formatMeetingDate(new Date(list.meeting.starts_at));
  return (
    <section id="no-infomercial" className="card flex scroll-mt-24 flex-col gap-3 p-[22px]" aria-labelledby="noinfo-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="noinfo-h" className="font-display m-0 text-[22px] font-extrabold">
          No 60-second infomercial on {when}
          {list.people.length ? ` (${list.people.length})` : ''}
        </h2>
        <a className="btn btn-outline btn-sm" href={pdf} download>
          Download PDF
        </a>
      </div>
      {!list.previous ? (
        <p className="text-ink-muted m-0">There is no earlier meeting to go by.</p>
      ) : (
        <>
          <p className="text-ink-muted m-0 text-sm">
            Members who left the {formatMeetingDate(new Date(list.previous.starts_at))} meeting before the end (Bylaws). Members excused for an emergency aren’t
            listed. To correct someone, set “Left early” on <Link href={`/admin/attendance?m=${list.previous.id}`}>Attendance for that meeting</Link>.
          </p>
          {!list.taken ? <p className="m-0 font-semibold">Attendance for that meeting hasn’t been taken yet, so this list may be incomplete.</p> : null}
          {list.people.length === 0 ? (
            <p className="m-0">Nobody: everyone may do their infomercial.</p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {list.people.map((p) => (
                <li key={p.id} className="bg-amber-tint rounded-full px-3 py-1 text-[15px] font-semibold">
                  {p.name}
                  <span className="text-ink-muted font-normal">
                    {p.how === 'admin' ? ' · marked by an admin' : p.leftAt ? ` · left ${formatMeetingTime(new Date(p.leftAt))}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
