import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar, PageHero } from '@/components/ui';
import { meetingAgenda, site } from '@/lib/content';
import { getLeadership } from '@/lib/data/public';
import { bylaws, governanceEffective, procedures, purpose } from '@/lib/governance';

export const metadata: Metadata = { title: 'Bylaws & Procedures' };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-heading m-0 text-xl font-bold">{title}</h3>
      {children}
    </div>
  );
}

const Bullets = ({ items }: { items: readonly string[] }) => (
  <ul className="m-0 flex flex-col gap-2 pl-5">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

export default async function BylawsPage() {
  const team = await getLeadership();
  const committee = team.filter((t) => /membership committee/i.test(t.role));

  return (
    <>
      <PageHero
        crumb="Bylaws & Procedures"
        title="Bylaws & Procedures"
        lead={
          <>
            How {site.name} runs, what we expect of members, and how meetings work. Effective {governanceEffective}.
          </>
        }
      />
      <div className="container-site flex flex-wrap items-start gap-10 py-12">
        <nav aria-label="On this page" className="card flex min-w-0 flex-[1_1_220px] flex-col gap-2 p-5 text-[15px] lg:sticky lg:top-6">
          <p className="eyebrow m-0">On this page</p>
          <a href="#bylaws">Bylaws</a>
          <a href="#procedures">Procedures</a>
          <a href="#agenda">Meeting agenda</a>
          <a href="#expectations">Member expectations</a>
          <a href="#definitions">Definitions</a>
          <Link href="/join" className="mt-2 font-bold">
            Apply to join →
          </Link>
        </nav>

        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-12 text-[17px] leading-relaxed">
          <section id="bylaws" aria-labelledby="bylaws-h" className="flex flex-col gap-7">
            <div>
              <h2 id="bylaws-h" className="h2">
                Bylaws
              </h2>
              <p className="text-ink-muted m-0 mt-1 text-sm">Effective {governanceEffective}</p>
            </div>
            <Block title="Purpose of the group">
              <p className="m-0">{purpose}</p>
            </Block>
            <Block title="What bylaws are">
              <p className="m-0">{bylaws.definition}</p>
            </Block>
            <section aria-labelledby="lead-h" className="flex flex-col gap-3">
              <h3 id="lead-h" className="font-display text-heading m-0 text-xl font-bold">
                Leadership &amp; responsibilities
              </h3>
              {team.length ? (
                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 p-0">
                  {team.map((t, i) => (
                    <li key={t.id} className="card flex items-center gap-3 p-3.5">
                      <Avatar name={t.name} size={44} index={i} />
                      <div className="min-w-0">
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-teal-text text-[15px] font-bold">{t.role}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted m-0">The leadership list will appear here.</p>
              )}
              {committee.length ? (
                <p className="m-0">
                  <strong>Membership Committee:</strong> {committee.map((c) => c.name).join(', ')}.
                </p>
              ) : null}
              <p className="m-0">{bylaws.committeeResponsibilities}</p>
            </section>
            <Block title="Meetings">
              <p className="m-0">{bylaws.meetings}</p>
            </Block>
            <Block title="Member acceptance criteria">
              <p className="m-0">{bylaws.acceptanceIntro}</p>
              <Bullets items={bylaws.acceptance} />
            </Block>
            <Block title="Member release criteria">
              <p className="m-0">{bylaws.releaseIntro}</p>
              <Bullets items={bylaws.release} />
            </Block>
          </section>

          <section id="procedures" aria-labelledby="proc-h" className="border-line flex flex-col gap-7 border-t pt-10">
            <div>
              <h2 id="proc-h" className="h2">
                Procedures
              </h2>
              <p className="text-ink-muted m-0 mt-1 text-sm">Effective {governanceEffective}</p>
            </div>
            <Block title="Purpose of the group">
              <p className="m-0">{purpose}</p>
            </Block>
            <Block title="What procedures are">
              <p className="m-0">{procedures.definition}</p>
            </Block>
            <div id="agenda">
              <Block title="Meeting agenda">
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Meeting agenda table">
                  <table className="data-table">
                    <caption className="sr-only">Meeting agenda, Pacific time</caption>
                    <thead>
                      <tr>
                        <th scope="col">Time (PT)</th>
                        <th scope="col">Agenda item</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetingAgenda.map((a) => (
                        <tr key={a.time}>
                          <td className="font-display font-bold tabular-nums">{a.time}</td>
                          <td>{a.item}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Block>
            </div>
            <div id="expectations" className="flex flex-col gap-5">
              <h3 className="font-display text-heading m-0 text-xl font-bold">Member expectations</h3>
              {[
                { t: 'Attendance', items: procedures.attendance },
                { t: 'Absences', items: procedures.absences },
                { t: 'Dues', items: [procedures.dues] },
                { t: 'Weekly expectations', items: procedures.weekly },
              ].map((g) => (
                <div key={g.t} className="flex flex-col gap-2">
                  <h4 className="m-0 text-base font-bold">{g.t}</h4>
                  <Bullets items={g.items} />
                </div>
              ))}
            </div>
            <Block title="Annual review">
              <p className="m-0">{procedures.annualReview}</p>
            </Block>
            <Block title="Meeting etiquette">
              <Bullets items={procedures.etiquette} />
            </Block>
            <Block title="10-minute presentation">
              <Bullets items={procedures.presentation} />
            </Block>
            <div id="definitions">
              <Block title="Definitions">
                <dl className="m-0 flex flex-col gap-3">
                  {procedures.definitions.map((d) => (
                    <div key={d.term}>
                      <dt className="font-bold">{d.term}</dt>
                      <dd className="text-ink-soft m-0">{d.text}</dd>
                    </div>
                  ))}
                </dl>
              </Block>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
