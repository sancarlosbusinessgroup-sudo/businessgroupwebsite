import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { loadReportCards } from '@/lib/data/report-cards';
import { attendancePct, goalsSummary, quarterOf, quarterOptions, quarterRange, reportCardLines } from '@/lib/report-card';
import { GoalsForm } from './GoalsForm';

export const metadata: Metadata = { title: 'Report Cards' };

/**
 * Admin → Report Cards (owner, 2026-11-24): a quarterly report card per member for the Member Coach's check-ins,
 * with the group's goals, each card downloadable as a PDF.
 */
export default async function ReportCardsPage({ searchParams }: { searchParams: Promise<{ q?: string; m?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const options = quarterOptions();
  const range = (sp.q && options.find((o) => o.key === sp.q)) || quarterRange(quarterOf(new Date()))!;
  const { members, goals, meetingsHeld } = await loadReportCards(range);
  const pdfAll = `/api/admin/report-cards?q=${range.key}`;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Report Cards</h1>
        <AdminNav current="/admin/report-cards" />
        <HowThisWorks tab="/admin/report-cards" />

        <form action="/admin/report-cards" className="card flex flex-wrap items-end gap-3 p-5" aria-label="Choose a quarter">
          <div className="min-w-0 flex-[1_1_240px]">
            <label className="label" htmlFor="q">
              Quarter
            </label>
            <select id="q" name="q" className="field" defaultValue={range.key}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-outline">
            Show
          </button>
          <a className="btn btn-primary" href={pdfAll} download>
            Download all cards (PDF)
          </a>
        </form>

        <GoalsForm goals={goals} />

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="cards-h">
          <h2 id="cards-h" className="font-display m-0 text-xl font-extrabold">
            {range.label}: {members.length} members
          </h2>
          <p className="text-ink-muted m-0 text-sm">
            {meetingsHeld} {meetingsHeld === 1 ? 'meeting' : 'meetings'} with attendance taken this quarter so far. Open a member’s card for the details.
          </p>
          {members.length === 0 ? (
            <EmptyState title="No members yet" />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {members.map((m) => {
                const lines = reportCardLines(m.card, goals);
                const sum = goalsSummary(lines);
                const pct = attendancePct(m.card);
                return (
                  <li key={m.id} id={`card-${m.id}`} className="border-line scroll-mt-24 rounded-xl border">
                    <details open={sp.m === m.id}>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 p-4">
                        <strong className="text-heading min-w-[200px]">{m.name}</strong>
                        <span className="text-ink-muted text-sm">
                          Attendance {pct == null ? '—' : `${pct}%`} · {m.card.oneOnOnes} one-on-ones · {m.card.referralsGiven} referrals · {m.card.visitors}{' '}
                          visitors
                        </span>
                        {sum ? (
                          <span className="ml-auto">
                            <Pill tone={sum.met === sum.total ? 'green' : sum.met === 0 ? 'red' : 'amber'}>
                              {sum.met} of {sum.total} goals met
                            </Pill>
                          </span>
                        ) : null}
                      </summary>
                      <div className="flex flex-col gap-3 px-4 pb-4">
                        {m.business ? <p className="text-ink-muted m-0 text-sm">{m.business}</p> : null}
                        <div className="overflow-x-auto">
                          <table className="data-table">
                            <caption className="sr-only">
                              Report card for {m.name}, {range.label}
                            </caption>
                            <thead>
                              <tr>
                                <th scope="col">What</th>
                                <th scope="col">This quarter</th>
                                <th scope="col">Goal</th>
                                <th scope="col">Met?</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((l) => (
                                <tr key={l.key}>
                                  <th scope="row">{l.label}</th>
                                  <td>{l.value}</td>
                                  <td>{l.goal ?? '—'}</td>
                                  <td>{l.met === null ? '—' : l.met ? <Pill tone="green">Yes</Pill> : <Pill tone="amber">Not yet</Pill>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <a className="btn btn-outline btn-sm self-start" href={`/api/admin/report-cards?q=${range.key}&m=${m.id}`} download>
                          Download {m.name}’s card (PDF)
                        </a>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
