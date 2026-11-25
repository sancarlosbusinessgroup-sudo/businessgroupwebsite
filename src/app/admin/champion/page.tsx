import { LiveRefresh } from '@/components/LiveRefresh';
import { getActivityVersion } from '@/lib/data/live';
import { ACTIVITY_KINDS } from '@/lib/live-activity';
import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { CHAMPION_2027_POINTS, CHAMPION_POINTS, MEETING_CHAMPION_FROM, meetingDateLabel, type ChampionRow } from '@/lib/champion';
import {
  currentPeriod,
  finalizeMeetingChampions,
  getChampionAwards,
  getChampionPeriods,
  getLifetimeRanking,
  getMeetingChampionRanking,
} from '@/lib/data/champion';
import { formatMoney } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { removeChampion } from '../../actions/champion';
import { ChampionForm } from './ChampionForm';

export const metadata: Metadata = { title: 'BARP Champion' };

/**
 * Admin → BARP Champion (owner, 2026-11-23): a champion at every meeting, from the points earned since the previous
 * meeting up to the end of this one. Lifetime points are kept and shown too. Monthly champions before that stay listed.
 */
export default async function AdminChampionPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireAdmin();
  // Live (owner, 2026-11-25): read before the page data; the page reloads by itself when activity changes.
  const liveVersion = await getActivityVersion(ACTIVITY_KINDS);
  const sp = await searchParams;
  await finalizeMeetingChampions().catch(() => 0);
  const now = new Date().toISOString();
  const all = await getChampionPeriods();
  // The meetings to choose from: those since per-meeting champions began, up to the next one coming.
  const current = currentPeriod(all);
  // A later meeting can be opened by its link (?p=<meeting id>) too.
  const periods = all
    .filter((p) => p.to >= MEETING_CHAMPION_FROM && (p.startsAt <= now || p.meetingId === current?.meetingId || p.meetingId === sp.p))
    .reverse();
  const lifetimeView = sp.p === 'lifetime';
  const period = lifetimeView ? null : (periods.find((p) => p.meetingId === sp.p) ?? current ?? periods[0] ?? null);
  const supabase = await createClient();
  const [ranking, lifetime, awards, membersRes] = await Promise.all([
    period ? getMeetingChampionRanking(period) : Promise.resolve(null),
    getLifetimeRanking(),
    getChampionAwards(30),
    supabase.from('profiles').select('id, first_name, last_name').eq('status', 'approved').order('first_name').order('last_name'),
  ]);
  const lifetimePts = new Map(lifetime.rows.map((r) => [r.id, r.points]));
  const rows: ChampionRow[] = lifetimeView ? lifetime.rows : (ranking?.rows ?? []);
  const auto = ranking?.auto ?? null;
  const award = period ? (awards.find((a) => a.kind === 'meeting' && a.key === period.meetingId) ?? null) : null;
  const pts = new Map(rows.map((r) => [r.id, r.points]));
  const members = (membersRes.data ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, points: pts.get(p.id) ?? 0 }));
  const ended = period ? period.to <= now : false;
  const label = (p: { startsAt: string; previousStart: string | null; meetingId: string }) =>
    `${meetingDateLabel(p.startsAt)} meeting${p.meetingId === current?.meetingId ? ' (in progress)' : ''}${p.previousStart ? ` · points since ${meetingDateLabel(p.previousStart)}` : ''}`;
  const title = lifetimeView ? 'Lifetime points' : period ? `${meetingDateLabel(period.startsAt)} meeting` : '';
  const P = CHAMPION_POINTS;
  const P27 = CHAMPION_2027_POINTS;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <LiveRefresh version={liveVersion} kinds={ACTIVITY_KINDS} />
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">BARP Champion</h1>
        <AdminNav current="/admin/champion" />
        <HowThisWorks tab="/admin/champion">
          A champion at every meeting: the member with the most points earned since the previous meeting, up to the end of this meeting, so points reported
          during the meeting count. {P.referral} point for each referral given, {P.oneOnOne} for each one-on-one done (once per pair), {P.meeting} for attending
          the meeting and {P.visitor} for each visitor brought who attended. From January 2027 also {P27.fiveMinute} for a 5-minute presentation and{' '}
          {P27.tenMinute} for a 10-minute presentation. To qualify, a member attends the meeting (a substitute counts) once its attendance is taken. Ties go to
          more closed business, then more referrals. Lifetime points keep adding up and never reset.
        </HowThisWorks>

        <form action="/admin/champion" className="card flex flex-wrap items-end gap-3 p-5" aria-label="Choose a meeting">
          <div className="min-w-0 flex-[1_1_320px]">
            <label className="label" htmlFor="p">
              Meeting
            </label>
            <select id="p" name="p" className="field" defaultValue={lifetimeView ? 'lifetime' : (period?.meetingId ?? '')}>
              {periods.map((p) => (
                <option key={p.meetingId} value={p.meetingId}>
                  {label(p)}
                </option>
              ))}
              <option value="lifetime">Lifetime points (all time)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-outline">
            Show
          </button>
        </form>

        {period ? (
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="pick-h">
            <h2 id="pick-h" className="font-display m-0 text-xl font-extrabold">
              Champion for the {title}
            </h2>
            <p className="text-ink-muted m-0 text-sm">
              Points from {period.previousStart ? `the end of the ${meetingDateLabel(period.previousStart)} meeting` : 'the start'} to the end of this meeting
              {ended ? '' : ' (so far)'}.
            </p>
            {award ? (
              <p className="m-0">
                <strong>{award.name}</strong> is the champion{award.overridden ? ' (chosen by an admin instead of the automatic pick)' : ''}.
                {award.reason ? <span className="text-ink-soft block">Reason: {award.reason}</span> : null}
              </p>
            ) : (
              <p className="text-ink-muted m-0">
                {ended ? 'Not recorded yet (it is recorded automatically once attendance is taken, or a day after the meeting).' : 'Leading so far:'}{' '}
                <strong>{auto ? `${auto.name} (${auto.points} points)` : 'nobody has points yet'}</strong>.
              </p>
            )}
            <ChampionForm
              key={period.meetingId}
              meetingId={period.meetingId}
              members={members}
              current={award?.profileId ?? null}
              autoId={auto?.id ?? null}
              reason={award?.reason ?? null}
            />
            {award ? (
              <form action={removeChampion}>
                <input type="hidden" name="meetingId" value={period.meetingId} />
                <button type="submit" className="btn btn-outline btn-sm text-red">
                  Remove this meeting’s champion
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="rank-h">
          <h2 id="rank-h" className="font-display m-0 text-xl font-extrabold">
            Ranking: {title || 'no meetings yet'}
          </h2>
          {!lifetimeView ? (
            <p className="text-ink-muted m-0 text-sm">
              {ranking?.meetingsTaken
                ? 'Attendance taken for this meeting.'
                : 'Attendance not taken for this meeting yet, so the attendance rule is not applied.'}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <EmptyState title="Nobody has points yet" />
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Champion ranking table">
              <table className="data-table">
                <caption className="sr-only">Points per member: {title}</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Member</th>
                    <th scope="col">Points</th>
                    {!lifetimeView ? <th scope="col">Lifetime points</th> : null}
                    <th scope="col">Referrals</th>
                    <th scope="col">Closed business</th>
                    <th scope="col">One-on-ones</th>
                    <th scope="col">Visitors</th>
                    <th scope="col">Meetings</th>
                    <th scope="col">Presentations</th>
                    {!lifetimeView ? <th scope="col">Qualifies</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <th scope="row">{r.name}</th>
                      <td className="font-bold tabular-nums">{r.points}</td>
                      {!lifetimeView ? <td className="tabular-nums">{lifetimePts.get(r.id) ?? 0}</td> : null}
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
                      {!lifetimeView ? <td>{r.attendanceShare === null ? '—' : r.eligible ? 'Yes' : 'No (missed the meeting)'}</td> : null}
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
                <li key={a.key} className="border-line-soft border-b py-2 last:border-b-0">
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
