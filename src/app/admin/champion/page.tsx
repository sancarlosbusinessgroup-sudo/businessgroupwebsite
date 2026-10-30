import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { CHAMPION_MIN_ATTENDANCE, CHAMPION_POINTS, monthOf, monthRange, previousMonth } from '@/lib/champion';
import { getChampionAwards, getChampionRanking } from '@/lib/data/champion';
import { formatMoney } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { removeChampion } from '../../actions/champion';
import { ChampionForm } from './ChampionForm';

export const metadata: Metadata = { title: 'BARP Champion' };

export default async function AdminChampionPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const thisMonth = monthOf(new Date());
  const month = sp.m && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : previousMonth(thisMonth);
  const { label, key } = monthRange(month);
  const supabase = await createClient();
  const [{ rows, auto, meetingsTaken }, awards, membersRes] = await Promise.all([
    getChampionRanking(month),
    getChampionAwards(24),
    supabase.from('profiles').select('id, first_name, last_name').eq('status', 'approved').order('first_name').order('last_name'),
  ]);
  const award = awards.find((a) => a.month === key) ?? null;
  const pts = new Map(rows.map((r) => [r.id, r.points]));
  const members = (membersRes.data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, points: pts.get(p.id) ?? 0 }));
  const months = Array.from({ length: 12 }, (_, i) => {
    let m = thisMonth;
    for (let k = 0; k < i; k++) m = previousMonth(m);
    return m;
  });
  const P = CHAMPION_POINTS;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">BARP Champion</h1>
        <HowThisWorks tab="/admin/champion" />
        <AdminNav current="/admin/champion" />
        <p className="text-ink-muted m-0 max-w-[820px]">
          Points per month: {P.referral} point for each referral given, {P.oneOnOne} for each one-on-one done (once per pair) and {P.meeting} for each meeting
          attended. Nothing else earns points. To qualify, a member attends at least {Math.round(CHAMPION_MIN_ATTENDANCE * 100)}% of the month’s meetings (a
          substitute counts for this, but earns no point). Ties go to more closed business, then more referrals.
        </p>

        <form action="/admin/champion" className="card flex flex-wrap items-end gap-3 p-5" aria-label="Choose a month">
          <div className="min-w-0 flex-[1_1_220px]">
            <label className="label" htmlFor="m">
              Month
            </label>
            <select id="m" name="m" className="field" defaultValue={month}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthRange(m).label}
                  {m === thisMonth ? ' (so far)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-outline">
            Show
          </button>
        </form>

        <section className="card flex flex-col gap-4 p-5" aria-labelledby="pick-h">
          <h2 id="pick-h" className="font-display m-0 text-xl font-extrabold">
            Champion for {label}
          </h2>
          {award ? (
            <p className="m-0">
              <strong>{award.name}</strong> is the champion{award.overridden ? ' (chosen by an admin instead of the automatic pick)' : ''}.
              {award.reason ? <span className="text-ink-soft block">Reason: {award.reason}</span> : null}
            </p>
          ) : (
            <p className="text-ink-muted m-0">
              Not chosen yet. Automatic pick: <strong>{auto ? `${auto.name} (${auto.points} points)` : 'nobody has points this month'}</strong>.
            </p>
          )}
          <ChampionForm month={month} members={members} current={award?.profileId ?? null} autoId={auto?.id ?? null} reason={award?.reason ?? null} />
          {award ? (
            <form action={removeChampion}>
              <input type="hidden" name="month" value={month} />
              <button type="submit" className="btn btn-outline btn-sm text-red">
                Remove this month’s champion
              </button>
            </form>
          ) : null}
        </section>

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="rank-h">
          <h2 id="rank-h" className="font-display m-0 text-xl font-extrabold">
            Ranking for {label}
          </h2>
          <p className="text-ink-muted m-0 text-sm">
            {meetingsTaken
              ? `${meetingsTaken} ${meetingsTaken === 1 ? 'meeting' : 'meetings'} with attendance taken this month.`
              : 'No meeting attendance taken this month yet, so the attendance rule is not applied.'}
          </p>
          {rows.length === 0 ? (
            <EmptyState title="Nobody has points this month yet" />
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Champion ranking table">
              <table className="data-table">
                <caption className="sr-only">Points per member for {label}</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Member</th>
                    <th scope="col">Points</th>
                    <th scope="col">Referrals</th>
                    <th scope="col">Closed business</th>
                    <th scope="col">One-on-ones</th>
                    <th scope="col">Visitors</th>
                    <th scope="col">Meetings</th>
                    <th scope="col">Presentations</th>
                    <th scope="col">Qualifies</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <th scope="row">{r.name}</th>
                      <td className="font-bold tabular-nums">{r.points}</td>
                      <td className="tabular-nums">{r.referrals}</td>
                      <td className="tabular-nums">
                        {r.closed}
                        {r.closedAmount ? ` (${formatMoney(r.closedAmount)})` : ''}
                      </td>
                      <td className="tabular-nums">{r.oneOnOnes}</td>
                      <td className="tabular-nums">
                        {r.visitors}
                        {r.joined ? ` (+${r.joined} joined)` : ''}
                      </td>
                      <td className="tabular-nums">
                        {r.meetings}
                        {r.substitutes ? ` (+${r.substitutes} sub)` : ''}
                      </td>
                      <td className="tabular-nums">{r.presentations}</td>
                      <td>{r.attendanceShare === null ? '—' : r.eligible ? 'Yes' : `No (${Math.round(r.attendanceShare * 100)}%)`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {awards.length ? (
          <section className="card flex flex-col gap-2 p-5" aria-labelledby="past-h">
            <h2 id="past-h" className="font-display m-0 text-xl font-extrabold">
              Past champions
            </h2>
            <ul className="m-0 list-none p-0">
              {awards.map((a) => (
                <li key={a.month} className="border-line-soft border-b py-2 last:border-b-0">
                  <strong>{a.label}:</strong> {a.name}
                  {a.reason ? <span className="text-ink-muted"> · {a.reason}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
