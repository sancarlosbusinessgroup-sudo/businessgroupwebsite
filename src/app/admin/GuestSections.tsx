import { EmptyState, Pill } from '@/components/ui';
import { guestStatusLabels, visitorSignInPath } from '@/lib/content';
import { env } from '@/lib/env';
import { formatShortDate, nowMs } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { setGuestOneOnOnes, setGuestStatus, setMemberStatus } from '../actions/admin';
import { reopenGuest } from '../actions/guests';
import { describeGuestEvent, isGuestStage } from '@/lib/guest-pipeline';
import { GuestBoard, type BoardGuest } from './GuestBoard';
import { SendZoomLinkButton } from './SendZoomLinkButton';
import { OpenApplicationOnHash } from './OpenApplicationOnHash';
import { InviteToApplyButton } from './InviteToApplyButton';
import { CopySignInLink } from './CopySignInLink';

/** The admin pages that show these sections; Approve/Decline errors come back to the page the admin was on. */
export type GuestSectionsPage = '/admin' | '/admin/guests';

/**
 * Pending applications, Visitor sign-in link and Guest invite requests on Admin → Guest Invites & Applications
 * (owner, 2026-11-23). They were also on the Overview until 2026-11-24. Callers must have checked requireAdmin().
 */
export async function GuestSections({ back }: { back: GuestSectionsPage }) {
  const supabase = await createClient();
  const now = nowMs();
  const [pendingRes, guestsRes, invitesRes, zoomSentRes, boardRes, declinedRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, business_name, website, guest_meetings_attended, created_at, categories(name), referrer:referred_by(first_name, last_name), member_contacts(email, phone), member_applications(*)',
      )
      .eq('status', 'pending')
      .order('created_at'),
    supabase
      .from('guest_requests')
      .select(
        'id, first_name, last_name, email, business_name, business_description, phone, website, invited_by_text, status, created_at, one_on_ones_done_at, source, guest_surveys(answered_at, coming_back, interested_in_joining, most_interesting, one_on_one_with, comments)',
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('email_log').select('dedupe_key, created_at').eq('kind', 'apply_invite').eq('status', 'sent').order('created_at').limit(500),
    supabase.from('email_log').select('dedupe_key, created_at').eq('kind', 'guest_zoom_link').eq('status', 'sent').order('created_at').limit(500),
    // Guest board (owner, 2026-11-24): everyone not declined, from the last year; approved members for 60 days.
    supabase
      .from('guest_requests')
      .select(
        'id, first_name, last_name, email, phone, website, business_name, business_description, invited_by_text, status, source, created_at, one_on_ones_done_at, pipeline_stage, stage_changed_at',
      )
      .is('declined_at', null)
      .gte('created_at', new Date(now - 365 * 86400000).toISOString())
      .or(`pipeline_stage.neq.approved,stage_changed_at.gte.${new Date(now - 60 * 86400000).toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('guest_requests')
      .select('id, first_name, last_name, business_name, declined_at, decline_method, decline_note, decliner:declined_by(first_name, last_name)')
      .not('declined_at', 'is', null)
      .order('declined_at', { ascending: false })
      .limit(30),
  ]);
  if (pendingRes.error || guestsRes.error) throw new Error('Could not load applications and guest requests');
  const invitedOn = new Map((invitesRes.data ?? []).map((r) => [r.dedupe_key.split(':')[0], formatShortDate(new Date(r.created_at))]));
  const zoomSentOn = new Map((zoomSentRes.data ?? []).map((r) => [r.dedupe_key.split(':')[0], formatShortDate(new Date(r.created_at))]));
  // Guests who have applied: their pending membership application, matched by email (for "Application approval").
  const pendingByEmail = new Map(
    pendingRes.data.flatMap((p) => {
      const c = Array.isArray(p.member_contacts) ? p.member_contacts[0] : p.member_contacts;
      return c?.email ? [[c.email.toLowerCase(), { id: p.id, name: `${p.first_name} ${p.last_name}` }] as const] : [];
    }),
  );

  const boardRows = boardRes.data ?? [];
  const { data: events } = boardRows.length
    ? await supabase
        .from('guest_events')
        .select('guest_id, created_at, kind, detail, actor:actor_id(first_name, last_name)')
        .in(
          'guest_id',
          boardRows.map((g) => g.id),
        )
        .order('created_at', { ascending: false })
        .limit(2000)
    : { data: [] };
  const history = new Map<string, BoardGuest['history']>();
  for (const e of events ?? []) {
    const actor = (Array.isArray(e.actor) ? e.actor[0] : e.actor) as { first_name: string; last_name: string } | null;
    const list = history.get(e.guest_id) ?? [];
    list.push({ at: formatShortDate(new Date(e.created_at)), who: actor ? `${actor.first_name} ${actor.last_name}` : null, text: describeGuestEvent(e) });
    history.set(e.guest_id, list);
  }
  const board: BoardGuest[] = boardRows.map((g) => ({
    id: g.id,
    name: `${g.first_name} ${g.last_name}`,
    business: g.business_name,
    email: g.email,
    phone: g.phone,
    website: g.website,
    about: g.business_description,
    invitedBy: g.invited_by_text,
    requestedOn: formatShortDate(new Date(g.created_at)),
    changedAt: g.stage_changed_at ?? g.created_at,
    stage: isGuestStage(g.pipeline_stage) ? g.pipeline_stage : 'review',
    status: g.status,
    signedIn: g.source === 'meeting_sign_in',
    zoomSentOn: zoomSentOn.get(g.id) ?? null,
    formSentOn: invitedOn.get(g.id) ?? null,
    interviewDone: !!g.one_on_ones_done_at,
    applicantId: pendingByEmail.get(g.email.toLowerCase())?.id ?? null,
    history: history.get(g.id) ?? [],
  }));
  const declined = declinedRes.data ?? [];

  return (
    <>
      <section id="board" className="flex scroll-mt-24 flex-col gap-3" aria-labelledby="board-h">
        <h2 id="board-h" className="font-display m-0 text-[22px] font-extrabold">
          Guest board
        </h2>
        <p className="text-ink-muted m-0 text-sm">
          Every guest from invite request to approved member. Cards move on by themselves when a step is done on the website (Zoom link sent, visited, applied,
          interview done, approved). To move a card by hand, drag it to another column or use <strong>Move to</strong> in its details. Moving a card by hand
          doesn’t send emails or approve anyone: use the buttons on the card for that.
        </p>
        <GuestBoard guests={board} />
        {declined.length ? (
          <details className="border-line rounded-xl border p-3">
            <summary className="cursor-pointer font-bold">Declined ({declined.length})</summary>
            <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
              {declined.map((d) => {
                const by = (Array.isArray(d.decliner) ? d.decliner[0] : d.decliner) as { first_name: string; last_name: string } | null;
                return (
                  <li key={d.id} className="border-line-soft flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0">
                    <div className="min-w-0 text-sm">
                      <strong className="text-heading">
                        {d.first_name} {d.last_name}
                      </strong>
                      {d.business_name ? ` · ${d.business_name}` : ''}
                      <div className="text-ink-muted">
                        Declined {d.declined_at ? formatShortDate(new Date(d.declined_at)) : ''}
                        {d.decline_method ? (d.decline_method === 'phone' ? ' · told by phone' : ' · told by email') : ''}
                        {by ? ` · by ${by.first_name} ${by.last_name}` : ''}
                      </div>
                      {d.decline_note ? <div className="whitespace-pre-line">{d.decline_note}</div> : null}
                    </div>
                    <form action={reopenGuest}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="btn btn-outline btn-sm">
                        Reopen
                        <span className="sr-only">
                          {' '}
                          {d.first_name} {d.last_name}
                        </span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="ap-h">
        <OpenApplicationOnHash />
        <h2 id="ap-h" className="font-display m-0 text-[22px] font-extrabold">
          Pending applications ({pendingRes.data.length})
        </h2>
        {pendingRes.data.length === 0 ? (
          <EmptyState title="No applications waiting" />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {pendingRes.data.map((p) => {
              const contact = Array.isArray(p.member_contacts) ? p.member_contacts[0] : p.member_contacts;
              const referrer = Array.isArray(p.referrer) ? p.referrer[0] : p.referrer;
              const app = Array.isArray(p.member_applications) ? p.member_applications[0] : p.member_applications;
              const refs = (app?.references ?? []) as {
                name?: string;
                business?: string | null;
                business_name?: string | null;
                email?: string | null;
                phone?: string | null;
                website?: string | null;
              }[];
              return (
                <li
                  key={p.id}
                  id={`application-${p.id}`}
                  className="border-line target:ring-teal flex scroll-mt-24 flex-wrap items-center justify-between gap-3 rounded-xl border p-4 target:ring-2"
                >
                  <div className="min-w-0">
                    <strong>
                      {p.first_name} {p.last_name}
                    </strong>{' '}
                    · {p.business_name} {p.categories ? `(${p.categories.name})` : ''}
                    <div className="text-ink-muted text-sm">
                      {contact?.email} · applied {formatShortDate(new Date(p.created_at))} · guest visits: {p.guest_meetings_attended}
                      {referrer ? ` · referred by ${referrer.first_name} ${referrer.last_name}` : ''}
                    </div>
                    {app ? (
                      <details className="mt-2">
                        <summary className="text-teal-text cursor-pointer text-sm font-bold">View application</summary>
                        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
                          {[
                            { k: 'Application date', v: formatShortDate(new Date(`${app.applied_on}T12:00:00Z`)) },
                            { k: 'Business phone', v: app.business_phone },
                            { k: 'Business address', v: app.business_address },
                            { k: 'Website', v: p.website },
                            { k: 'In business for', v: app.years_in_business },
                            { k: 'Product or service', v: app.product_service },
                            { k: 'Education & credentials', v: app.credentials },
                            { k: 'Networking groups', v: app.networking_groups },
                            { k: 'Signed', v: `${app.signature_name} · ${formatShortDate(new Date(app.agreed_at))}` },
                          ].map((r) => (
                            <div key={r.k}>
                              <dt className="text-ink-muted text-[13px] font-bold">{r.k}</dt>
                              <dd className="m-0 whitespace-pre-line">{r.v || '—'}</dd>
                            </div>
                          ))}
                        </dl>
                        {refs.length ? (
                          <div className="mt-3">
                            <p className="text-ink-muted m-0 text-[13px] font-bold">References</p>
                            <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-[15px]">
                              {refs.map((r, i) => (
                                <li key={i}>
                                  <strong>{r.name}</strong>
                                  {r.business ? ` · ${r.business}` : ''}
                                  {r.business_name ? ` · ${r.business_name}` : ''}
                                  {r.email ? (
                                    <>
                                      {' · '}
                                      <a href={`mailto:${r.email}`}>{r.email}</a>
                                    </>
                                  ) : null}
                                  {r.phone ? ` · ${r.phone}` : ''}
                                  {r.website ? ` · ${r.website}` : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </details>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <form action={setMemberStatus}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value="approved" />
                      <button type="submit" className="btn btn-primary btn-sm">
                        Approve
                        <span className="sr-only">
                          {' '}
                          {p.first_name} {p.last_name}
                        </span>
                      </button>
                    </form>
                    <form action={setMemberStatus}>
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value="declined" />
                      <button type="submit" className="btn btn-outline btn-sm">
                        Decline
                        <span className="sr-only">
                          {' '}
                          {p.first_name} {p.last_name}
                        </span>
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-[22px]" aria-labelledby="signin-h">
        <h2 id="signin-h" className="font-display m-0 text-[22px] font-extrabold">
          Visitor sign-in link
        </h2>
        <p className="text-ink-muted m-0 text-sm">
          For visitors who join the Zoom without having asked for an invite. Copy this link and paste it in the Zoom chat during the meeting. Visitors fill in
          their name, email, phone, business and who invited them, and appear in the list below, already marked as visited and “Signed in at the meeting”.
        </p>
        <CopySignInLink url={`${env.siteUrl}${visitorSignInPath}`} />
      </section>

      <section id="guests" className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="gr-h">
        <h2 id="gr-h" className="font-display m-0 text-[22px] font-extrabold">
          Guest invite requests
        </h2>
        <p className="text-ink-muted m-0 text-sm">
          <strong>Send Zoom link</strong> emails the guest the Zoom link for their meeting. After they have visited and the Membership Committee agrees, use{' '}
          <strong>Invite to apply</strong> to email them the membership application form, already filled in with their name and email. Mark their one-on-ones
          with the Membership Committee as done, then <strong>Approved</strong> approves their application and emails them their welcome.
        </p>
        {guestsRes.data.length === 0 ? (
          <EmptyState title="No guest requests yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Guest invite requests</caption>
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Invited by</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Zoom link</th>
                  <th scope="col">Status</th>
                  <th scope="col">Application</th>
                  <th scope="col">One-on-ones</th>
                  <th scope="col">Application approval</th>
                </tr>
              </thead>
              <tbody>
                {guestsRes.data.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <strong>
                        {g.first_name} {g.last_name}
                      </strong>
                      <div className="text-ink-muted text-sm">{g.business_name}</div>
                      {g.business_description ? (
                        <details className="text-sm">
                          <summary className="cursor-pointer">About their business</summary>
                          <p className="m-0 mt-1 max-w-[36ch] whitespace-pre-line">{g.business_description}</p>
                        </details>
                      ) : null}
                      <SurveyAnswers survey={g.guest_surveys} />
                      {g.website ? (
                        <div className="text-sm">
                          <a href={g.website} target="_blank" rel="noopener noreferrer">
                            {g.website.replace(/^https?:\/\//i, '')}
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <a href={`mailto:${g.email}`}>{g.email}</a>
                    </td>
                    <td className="whitespace-nowrap">{g.phone ?? '—'}</td>
                    <td>{g.invited_by_text ?? '—'}</td>
                    <td className="whitespace-nowrap">
                      {formatShortDate(new Date(g.created_at))}
                      {g.source === 'meeting_sign_in' ? (
                        <div className="mt-1">
                          <Pill tone="teal">Signed in at the meeting</Pill>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {g.status === 'joined' ? (
                        '—'
                      ) : (
                        <SendZoomLinkButton id={g.id} name={`${g.first_name} ${g.last_name}`} sentOn={zoomSentOn.get(g.id) ?? null} />
                      )}
                    </td>
                    <td>
                      {g.status === 'requested' ? (
                        <form action={setGuestStatus}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="status" value="visited" />
                          <button type="submit" className="btn btn-outline btn-sm">
                            Mark visited
                            <span className="sr-only">
                              {' '}
                              for {g.first_name} {g.last_name}
                            </span>
                          </button>
                        </form>
                      ) : (
                        <Pill tone={g.status === 'joined' ? 'green' : 'teal'}>{guestStatusLabels[g.status]}</Pill>
                      )}
                    </td>
                    <td>
                      {g.status === 'requested' || g.status === 'visited' ? (
                        <InviteToApplyButton id={g.id} name={`${g.first_name} ${g.last_name}`} sentOn={invitedOn.get(g.id) ?? null} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {g.one_on_ones_done_at ? (
                        <div className="flex flex-col items-start gap-1">
                          <Pill tone="green">Done</Pill>
                          <form action={setGuestOneOnOnes}>
                            <input type="hidden" name="id" value={g.id} />
                            <input type="hidden" name="done" value="false" />
                            <button type="submit" className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-sm underline">
                              Undo
                              <span className="sr-only">
                                {' '}
                                one-on-ones for {g.first_name} {g.last_name}
                              </span>
                            </button>
                          </form>
                        </div>
                      ) : (
                        <form action={setGuestOneOnOnes}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="done" value="true" />
                          <button type="submit" className="btn btn-outline btn-sm">
                            Done?
                            <span className="sr-only">
                              {' '}
                              Mark one-on-ones done for {g.first_name} {g.last_name}
                            </span>
                          </button>
                        </form>
                      )}
                    </td>
                    <td>
                      {(() => {
                        if (g.status === 'joined') return <Pill tone="green">Approved</Pill>;
                        const applicant = pendingByEmail.get(g.email.toLowerCase());
                        if (!applicant) return <span className="text-ink-muted text-sm">Waiting for their application</span>;
                        return (
                          <div className="flex flex-col items-start gap-1.5">
                            <a href={`#application-${applicant.id}`} className="text-sm font-bold">
                              See application
                              <span className="sr-only">
                                {' '}
                                of {g.first_name} {g.last_name}
                              </span>
                            </a>
                            <form action={setMemberStatus}>
                              <input type="hidden" name="back" value={back} />
                              <input type="hidden" name="id" value={applicant.id} />
                              <input type="hidden" name="status" value="approved" />
                              <button type="submit" className="btn btn-primary btn-sm">
                                Approved
                                <span className="sr-only">
                                  {' '}
                                  (approve the application of {g.first_name} {g.last_name})
                                </span>
                              </button>
                            </form>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

type Survey = {
  answered_at: string | null;
  coming_back: string | null;
  interested_in_joining: string | null;
  most_interesting: string | null;
  one_on_one_with: string | null;
  comments: string | null;
};

/** Guest follow-up survey answers (owner meeting 2026-10-30), under the guest's name. */
function SurveyAnswers({ survey }: { survey: Survey | Survey[] | null }) {
  const s = Array.isArray(survey) ? survey[0] : survey;
  if (!s) return null;
  if (!s.answered_at) return <div className="text-ink-muted text-sm">Survey sent, no answer yet</div>;
  const yn = (v: string | null) => (v === 'yes' ? 'Yes' : v === 'maybe' ? 'Maybe' : v === 'no' ? 'No' : '—');
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold">Survey answers</summary>
      <dl className="m-0 mt-1 flex max-w-[36ch] flex-col gap-1">
        <div>
          <dt className="inline font-semibold">Coming back: </dt>
          <dd className="inline">{yn(s.coming_back)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Interested in joining: </dt>
          <dd className="inline">{yn(s.interested_in_joining)}</dd>
        </div>
        {s.most_interesting ? (
          <div>
            <dt className="font-semibold">Most interesting</dt>
            <dd className="m-0 whitespace-pre-line">{s.most_interesting}</dd>
          </div>
        ) : null}
        {s.one_on_one_with ? (
          <div>
            <dt className="font-semibold">One-on-one with</dt>
            <dd className="m-0">{s.one_on_one_with}</dd>
          </div>
        ) : null}
        {s.comments ? (
          <div>
            <dt className="font-semibold">Anything else</dt>
            <dd className="m-0 whitespace-pre-line">{s.comments}</dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}
