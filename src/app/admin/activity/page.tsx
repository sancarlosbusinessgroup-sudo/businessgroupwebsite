import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { referralStatusLabels } from '@/lib/content';
import { formatMoney, formatShortDate } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { deleteMemberEvent } from '../../actions/events';
import { deleteOneOnOne, deleteReferral } from '../../actions/member';

export const metadata: Metadata = { title: 'Member activity' };

const day = (d: string) => formatShortDate(new Date(d + 'T12:00:00Z'));
type Person = { first_name: string; last_name: string } | null;
const nm = (p: Person) => (p ? `${p.first_name} ${p.last_name}` : 'Former member');

/** Everything members have filed, for admins to remove mistakes or duplicates (owner, 2026-10-23). */
export default async function AdminActivityPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [refRes, oooRes, evRes] = await Promise.all([
    supabase
      .from('referrals')
      .select(
        'id, contact_name, status, amount, created_at, from:profiles!referrals_from_id_fkey(first_name, last_name), to:profiles!referrals_to_id_fkey(first_name, last_name)',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('one_on_ones')
      .select(
        'id, met_on, confirmed_at, reporter:profiles!one_on_ones_reporter_id_fkey(first_name, last_name), partner:profiles!one_on_ones_partner_id_fkey(first_name, last_name)',
      )
      .order('met_on', { ascending: false })
      .limit(200),
    supabase
      .from('member_events')
      .select('id, slug, title, starts_at, host:profiles(first_name, last_name)')
      .order('starts_at', { ascending: false })
      .limit(200),
  ]);
  if (refRes.error || oooRes.error || evRes.error) throw new Error('Could not load member activity');
  const refs = refRes.data ?? [];
  const ooos = oooRes.data ?? [];
  const events = evRes.data ?? [];

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Member activity</h1>
        <HowThisWorks tab="/admin/activity" />
        <AdminNav current="/admin/activity" />
        <p className="text-ink-muted m-0 max-w-[760px]">
          Referral slips, one-on-ones and member events, newest first. Delete a duplicate or a mistake here; it is removed for everyone and from the stats.
        </p>

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="refs-h">
          <h2 id="refs-h" className="font-display m-0 text-xl font-extrabold">
            Referral slips ({refs.length})
          </h2>
          {refs.length === 0 ? (
            <EmptyState title="No referral slips yet" />
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {refs.map((r) => (
                <li key={r.id} className="border-line-soft flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                  <span className="min-w-0">
                    <strong>{nm(r.from as Person)}</strong> → <strong>{nm(r.to as Person)}</strong> · {r.contact_name}
                    <span className="text-ink-muted block text-sm">
                      {formatShortDate(new Date(r.created_at))} · {referralStatusLabels[r.status]}
                      {r.amount !== null ? ` · ${formatMoney(r.amount)}` : ''}
                    </span>
                  </span>
                  <ConfirmDelete action={deleteReferral} id={r.id} what={`referral slip for ${r.contact_name}`} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="ooo-h">
          <h2 id="ooo-h" className="font-display m-0 text-xl font-extrabold">
            One-on-ones ({ooos.length})
          </h2>
          {ooos.length === 0 ? (
            <EmptyState title="No one-on-ones yet" />
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {ooos.map((o) => (
                <li key={o.id} className="border-line-soft flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                  <span className="min-w-0">
                    <strong>{nm(o.reporter as Person)}</strong> with <strong>{nm(o.partner as Person)}</strong>
                    <span className="text-ink-muted block text-sm">
                      {day(o.met_on)} · {o.confirmed_at ? 'Confirmed' : 'Awaiting confirmation'}
                    </span>
                  </span>
                  <ConfirmDelete
                    action={deleteOneOnOne}
                    id={o.id}
                    what={`one-on-one on ${day(o.met_on)} between ${nm(o.reporter as Person)} and ${nm(o.partner as Person)}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="ev-h">
          <h2 id="ev-h" className="font-display m-0 text-xl font-extrabold">
            Member events ({events.length})
          </h2>
          {events.length === 0 ? (
            <EmptyState title="No member events yet" />
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {events.map((e) => (
                <li key={e.id} className="border-line-soft flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
                  <span className="min-w-0">
                    <Link href={`/events/${e.slug}`}>{e.title}</Link>
                    <span className="text-ink-muted block text-sm">
                      {formatShortDate(new Date(e.starts_at))} · posted by {nm(e.host as unknown as Person)}
                    </span>
                  </span>
                  <ConfirmDelete action={deleteMemberEvent} id={e.id} what={`event “${e.title}”`} extra={{ back: '/admin/activity' }} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
