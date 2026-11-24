import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { Notice, Pill } from '@/components/ui';
import type { ActionTone } from '@/lib/admin-action-items';
import { isSuperAdmin, requireAdmin } from '@/lib/auth';
import { adminLinksFor } from '@/lib/content';
import { loadActionItems } from '@/lib/data/admin-action-items';
import { loadNoInfomercialList } from '@/lib/data/no-infomercial';
import { NoInfomercialCard } from '@/components/NoInfomercialCard';
import { getNextMeeting } from '@/lib/data/public';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { parseZoomMeetingId } from '@/lib/zoom';
import { zoomConfigured } from '@/lib/zoom-api';

export const metadata: Metadata = { title: 'Admin' };

const errors: Record<string, string> = {
  category_full:
    'That category is full. Raise its seats under “Category seats” on the Guest Invites & Applications tab, or ask the applicant to pick another category.',
  save: 'Something went wrong. Please try again.',
};

const toneLabel: Record<ActionTone, string> = { red: 'Urgent', amber: 'To do', teal: 'Follow up' };
const toneBar: Record<ActionTone, string> = { red: 'border-l-red', amber: 'border-l-amber', teal: 'border-l-teal' };

/**
 * Admin → Overview (owner, 2026-11-24): "Items that Need Immediate Action" pulled from the other tabs, the Zoom host
 * button, and a card for every admin tab with a short description and a button to it. The sections that used to be
 * here moved to their tabs (see MovedSections.tsx).
 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; zoomError?: string }> }) {
  const { error, zoomError } = await searchParams;
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const [items, next, noInfomercial] = await Promise.all([loadActionItems(supabase), getNextMeeting(), loadNoInfomercialList(supabase)]);
  const { data: nextLink } = next ? await supabase.from('meeting_links').select('join_url').eq('meeting_id', next.id).maybeSingle() : { data: null };
  const nextZoomId = parseZoomMeetingId(nextLink?.join_url);
  const tabs = adminLinksFor(isSuperAdmin(viewer)).filter((l) => l.href !== '/admin');

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Admin</h1>
        <AdminNav current="/admin" />
        <HowThisWorks tab="/admin" />
        {error && errors[error] ? <Notice tone="error">{errors[error]}</Notice> : null}

        <section id="action-items" className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="todo-h">
          <h2 id="todo-h" className="font-display m-0 text-[22px] font-extrabold">
            Items that Need Immediate Action{items.length ? ` (${items.length})` : ''}
          </h2>
          {items.length === 0 ? (
            <p className="text-ink-muted m-0">Nothing needs your attention right now.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {items.map((it) => (
                <li
                  key={it.key}
                  className={`border-line flex flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 p-4 ${toneBar[it.tone]}`}
                >
                  <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Pill tone={it.tone === 'red' ? 'red' : it.tone === 'amber' ? 'amber' : 'teal'}>{toneLabel[it.tone]}</Pill>
                      <span className="text-ink-muted text-sm font-semibold">{it.tab}</span>
                    </span>
                    <strong className="text-heading">{it.title}</strong>
                    <span className="text-ink-soft text-[15px]">{it.detail}</span>
                  </div>
                  <Link href={it.href} className="btn btn-outline btn-sm">
                    Open {it.tab}
                    <span aria-hidden="true"> →</span>
                    <span className="sr-only">: {it.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <NoInfomercialCard list={noInfomercial} />

        <section id="zoom" className="card flex flex-col gap-3 p-[22px]" aria-labelledby="zoom-h">
          <h2 id="zoom-h" className="font-display m-0 text-[22px] font-extrabold">
            Zoom
          </h2>
          {zoomError ? <Notice tone="error">{zoomError.slice(0, 300)}</Notice> : null}
          {next ? (
            <p className="m-0">
              Next meeting: <strong>{formatMeetingDate(new Date(next.starts_at))}</strong>, {formatMeetingTime(new Date(next.starts_at))}
              {nextZoomId ? ` · Zoom meeting ${nextZoomId.replace(/^(\d{3})(\d{4})(\d+)$/, '$1 $2 $3')}` : ' · no Zoom link saved'}
            </p>
          ) : (
            <p className="m-0">There is no upcoming meeting on the calendar.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {zoomConfigured() && next && nextZoomId ? (
              <a className="btn btn-primary" href="/admin/zoom/start">
                Start meeting as host
              </a>
            ) : (
              <span className="text-ink-muted text-sm">Starting the meeting from here needs the Zoom keys and a Zoom link on the next meeting.</span>
            )}
            <Link className="btn btn-outline btn-sm" href="/admin/attendance">
              Attendance
            </Link>
          </div>
          <p className="text-ink-muted m-0 text-sm">
            Opens Zoom as the host. Sign in to Zoom with the group’s account if asked. Only one person can be host: the first manager starts it, then makes the
            others co-hosts in Zoom (Participants → hover a name → More → Make co-host).
          </p>
        </section>

        <section className="flex flex-col gap-3.5" aria-labelledby="tabs-h">
          <h2 id="tabs-h" className="font-display m-0 text-[22px] font-extrabold">
            Admin tabs
          </h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 lg:grid-cols-2">
            {tabs.map((t) => {
              const id = `tab-${t.href.replace(/\W+/g, '-')}`;
              return (
                <li key={t.href} className="card flex flex-wrap items-center justify-between gap-3 p-[22px]">
                  <div className="min-w-0 flex-[1_1_260px]">
                    <h3 id={id} className="font-display m-0 text-[20px] font-extrabold">
                      {t.label}
                    </h3>
                    <p className="text-ink-muted m-0 text-[15px]">{t.blurb}</p>
                  </div>
                  <Link href={t.href} className="btn btn-outline">
                    Open {t.label}
                    <span aria-hidden="true"> →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
