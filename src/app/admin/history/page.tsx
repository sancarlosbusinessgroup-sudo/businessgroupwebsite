import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/database.types';

export const metadata: Metadata = { title: 'Change history' };

const tableLabels: Record<string, string> = {
  profiles: 'Profile',
  member_contacts: 'Contact details',
  meetings: 'Meeting',
  meeting_links: 'Zoom link',
  meeting_speakers: 'Presentation slot',
  member_events: 'Member event',
  gallery_photos: 'Gallery photo',
  referrals: 'Referral',
  one_on_ones: 'One-on-one',
  one_on_one_requests: 'One-on-one request',
  rsvps: 'RSVP',
};
const actionLabels = { insert: 'Added', update: 'Changed', delete: 'Removed' } as const;
const actionTones = { insert: 'green', update: 'teal', delete: 'red' } as const;
const hidden = new Set([
  'id',
  'created_at',
  'updated_at',
  'meeting_id',
  'profile_id',
  'from_id',
  'to_id',
  'reporter_id',
  'partner_id',
  'requester_id',
  'invitee_id',
  'host_id',
  'uploaded_by',
]);

function show(v: Json | undefined): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v.length > 80 ? `${v.slice(0, 77)}…` : v;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return JSON.stringify(v);
}

/** The fields that changed, as "field: before → after" lines. */
function diff(before: Json | null, after: Json | null, action: keyof typeof actionLabels): string[] {
  const b = (before && typeof before === 'object' && !Array.isArray(before) ? before : {}) as Record<string, Json | undefined>;
  const a = (after && typeof after === 'object' && !Array.isArray(after) ? after : {}) as Record<string, Json | undefined>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !hidden.has(k));
  const lines = keys.map((k) => {
    const label = k.replace(/_/g, ' ');
    if (action === 'update') return `${label}: ${show(b[k])} → ${show(a[k])}`;
    const v = action === 'delete' ? b[k] : a[k];
    return v === null || v === undefined || v === '' ? null : `${label}: ${show(v)}`;
  });
  return lines.filter((l): l is string => !!l);
}

/** Admin → Change history: every change an admin made to someone else's data (owner, 2026-10-27). */
export default async function AdminHistoryPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  let q = supabase
    .from('admin_audit_log')
    .select('id, action, table_name, row_id, subject_id, before, after, created_at, actor:profiles!admin_audit_log_actor_id_fkey(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (member) q = q.eq('subject_id', member);
  const { data: rows, error } = await q;
  if (error) throw new Error('Could not load the change history');
  const subjectIds = [...new Set(rows.map((r) => r.subject_id).filter((x): x is string => !!x))];
  const { data: subjects } = subjectIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', subjectIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const subjectName = new Map((subjects ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`]));
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Change history</h1>
        <AdminNav current="/admin/history" />
        <HowThisWorks tab="/admin/history">
          Every change an admin makes to another member&apos;s profile, slots, events, photos or activity records: who, what, before and after. Members
          can&apos;t see this. Changes members make to their own data are not listed.
          {member ? (
            <>
              {' '}
              Showing one member: <Link href="/admin/history">show everyone</Link>.
            </>
          ) : null}
        </HowThisWorks>
        {rows.length === 0 ? (
          <EmptyState title="No changes recorded yet">Admin edits will appear here as they happen.</EmptyState>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr className="bg-line-soft text-ink-muted text-left text-xs tracking-wide uppercase">
                  <th className="px-4 py-3 font-bold">When</th>
                  <th className="px-4 py-3 font-bold">By</th>
                  <th className="px-4 py-3 font-bold">What</th>
                  <th className="px-4 py-3 font-bold">Whose</th>
                  <th className="px-4 py-3 font-bold">Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const action = r.action as keyof typeof actionLabels;
                  const lines = diff(r.before, r.after, action);
                  return (
                    <tr key={r.id} className="border-line border-t align-top">
                      <td className="text-ink-muted px-4 py-3 text-sm whitespace-nowrap">{fmt.format(new Date(r.created_at))}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.actor ? `${r.actor.first_name} ${r.actor.last_name}` : 'Former admin'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Pill tone={actionTones[action]}>{actionLabels[action]}</Pill> {tableLabels[r.table_name] ?? r.table_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.subject_id ? (
                          <Link href={`/admin/history?member=${r.subject_id}`}>{subjectName.get(r.subject_id) ?? 'Former member'}</Link>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {lines.length === 0 ? (
                          <span className="text-ink-muted">—</span>
                        ) : (
                          <ul className="m-0 list-none p-0">
                            {lines.slice(0, 8).map((l) => (
                              <li key={l}>{l}</li>
                            ))}
                            {lines.length > 8 ? <li className="text-ink-muted">…and {lines.length - 8} more</li> : null}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
