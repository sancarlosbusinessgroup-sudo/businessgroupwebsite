import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { getLeadership } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { removeLeader } from '../../actions/admin';
import { AddLeaderForm, EditLeaderForm } from './LeaderForms';

export const metadata: Metadata = { title: 'Management' };

export default async function AdminLeadershipPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [team, membersRes] = await Promise.all([
    getLeadership(),
    supabase.from('profiles').select('id, first_name, last_name, business_name').eq('status', 'approved').order('first_name'),
  ]);
  if (membersRes.error) throw new Error('Could not load members');
  const members = membersRes.data.map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name} · ${m.business_name}` }));

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Management</h1>
        <AdminNav current="/admin/leadership" />
        <HowThisWorks tab="/admin/leadership">
          The people listed here appear in the Management section of the About page, in sort order. While the list is empty, About shows the original leadership
          text.
        </HowThisWorks>
        <div className="flex flex-wrap items-start gap-5">
          <section className="card flex min-w-0 flex-[3_1_520px] flex-col gap-3.5 p-[22px]" aria-labelledby="team-h">
            <h2 id="team-h" className="h3">
              On the About page ({team.length})
            </h2>
            {team.length === 0 ? (
              <EmptyState title="Nobody listed yet">Add the group&apos;s leaders with the form.</EmptyState>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {team.map((t) => (
                  <li key={t.id} className="border-line flex flex-col gap-3 rounded-xl border p-4">
                    <EditLeaderForm leader={t} members={members} />
                    <form action={removeLeader}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="btn btn-sm text-red px-0">
                        Remove<span className="sr-only"> {t.name}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="min-w-0 flex-[2_1_320px]">
            <AddLeaderForm members={members} />
          </div>
        </div>
      </div>
    </div>
  );
}
