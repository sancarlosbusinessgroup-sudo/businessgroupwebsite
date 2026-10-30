import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Members' };

const statusTone = { approved: 'green', pending: 'amber', declined: 'red', inactive: 'gray' } as const;
const statusLabel = { approved: 'Approved', pending: 'Pending', declined: 'Declined', inactive: 'Inactive' } as const;

/** Admin → Members: every member (pending, approved, declined, inactive); open one to edit anything (owner, 2026-10-27). */
export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = '', status = '' } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, business_name, status, role, is_owner, created_at, categories(name), member_contacts(email, phone)')
    .order('first_name')
    .order('last_name');
  if (status && status in statusTone) query = query.eq('status', status as keyof typeof statusTone);
  const term = q.trim();
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    query = query.or(`first_name.ilike.${like},last_name.ilike.${like},business_name.ilike.${like}`);
  }
  const { data: members, error } = await query;
  if (error) throw new Error('Could not load members');

  const filterLink = (s: string, label: string) => (
    <Link
      href={`/admin/members?${new URLSearchParams({ ...(term ? { q: term } : {}), ...(s ? { status: s } : {}) })}`}
      aria-current={status === s ? 'page' : undefined}
      className={`font-display flex min-h-10 items-center rounded-full px-4 text-sm font-bold no-underline ${status === s ? 'bg-heading text-surface' : 'border-line-strong bg-surface text-ink-soft border'}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Members</h1>
        <AdminNav current="/admin/members" />
        <HowThisWorks tab="/admin/members">
          Open a member to edit their profile, contact phone, category, status, photo and logo, and to fix anything they filed. Every change you make to someone
          else&apos;s record is kept in the <Link href="/admin/history">change history</Link>.
        </HowThisWorks>
        <form action="/admin/members" method="get" role="search" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="label" htmlFor="q">
              Search
            </label>
            <input id="q" name="q" type="search" className="field" defaultValue={term} placeholder="Name or business" />
          </div>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {filterLink('', 'All')}
          {filterLink('approved', 'Approved')}
          {filterLink('pending', 'Pending')}
          {filterLink('inactive', 'Inactive')}
          {filterLink('declined', 'Declined')}
        </div>
        {members.length === 0 ? (
          <EmptyState title="No members match">Try another name, or clear the filters.</EmptyState>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full border-collapse text-[15px]">
              <caption className="sr-only">
                {members.length} member{members.length === 1 ? '' : 's'}
              </caption>
              <thead>
                <tr className="bg-line-soft text-ink-muted text-left text-xs tracking-wide uppercase">
                  <th className="px-4 py-3 font-bold">Member</th>
                  <th className="px-4 py-3 font-bold">Business</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 font-bold">Contact</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const c = Array.isArray(m.member_contacts) ? m.member_contacts[0] : m.member_contacts;
                  return (
                    <tr key={m.id} className="border-line border-t align-top">
                      <td className="px-4 py-3">
                        <span className="font-bold">
                          {m.first_name} {m.last_name}
                        </span>
                        {m.role === 'admin' ? (
                          <span className="ml-2">
                            <Pill tone="teal">{m.is_owner ? 'Owner' : 'Admin'}</Pill>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{m.business_name}</td>
                      <td className="text-ink-muted px-4 py-3">{m.categories?.name ?? '—'}</td>
                      <td className="text-ink-muted px-4 py-3 text-sm">
                        {c?.email ?? '—'}
                        {c?.phone ? <span className="block">{c.phone}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={statusTone[m.status]}>{statusLabel[m.status]}</Pill>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/members/${m.id}`} className="btn btn-outline btn-sm">
                          Edit
                          <span className="sr-only">
                            {' '}
                            {m.first_name} {m.last_name}
                          </span>
                        </Link>
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
