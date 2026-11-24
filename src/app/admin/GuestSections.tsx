import { EmptyState, Pill } from '@/components/ui';
import { visitorSignInPath } from '@/lib/content';
import { env } from '@/lib/env';
import { formatShortDate, formatSlot, nowMs } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { setMemberStatus } from '../actions/admin';
import { GUEST_STEPS, guestStepLabels, isGuestStage, rankSlots, stepState, type PanelSummary } from '@/lib/guest-pipeline';
import { GuestBoard, type BoardGuest } from './GuestBoard';
import { ApproveApplicantButton, GuestProgress, GuestStepsProvider, StepCell, UndoStep, type PanelistOption } from './GuestSteps';
import { AddGuestForm } from './AddGuestForm';
import { OpenApplicationOnHash } from './OpenApplicationOnHash';
import { CopySignInLink } from './CopySignInLink';

/** The admin pages that show these sections; Approve/Decline errors come back to the page the admin was on. */
export type GuestSectionsPage = '/admin' | '/admin/guests';

const firstOf = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

/**
 * Guest board, Pending applications, Visitor sign-in link and Guest invite requests on Admin → Guest Invites &
 * Applications (owner, 2026-11-23/24/25). Callers must have checked requireAdmin().
 */
export async function GuestSections({ back }: { back: GuestSectionsPage }) {
  const supabase = await createClient();
  const now = nowMs();
  const [pendingRes, guestsRes, invitesRes, zoomSentRes, welcomeRes, leadersRes, membersRes, nextRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, business_name, website, guest_meetings_attended, created_at, categories(name), referrer:referred_by(first_name, last_name), member_contacts(email, phone), member_applications(*)',
      )
      .eq('status', 'pending')
      .order('created_at'),
    // Everyone from the last year (owner, 2026-11-24/25): the board and the guest list show the same people.
    supabase
      .from('guest_requests')
      .select(
        'id, first_name, last_name, email, phone, website, business_name, business_description, invited_by_text, status, source, created_at, one_on_ones_done_at, pipeline_stage, stage_changed_at, accepted_at, declined_at, decline_called_at, zoom_email_dismissed_at, added_by, membership_declined_at, membership_called_at, welcome_email_dismissed_at, guest_surveys(answered_at, coming_back, interested_in_joining, most_interesting, one_on_one_with, comments)',
      )
      .gte('created_at', new Date(now - 365 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('email_log').select('dedupe_key, created_at').eq('kind', 'apply_invite').eq('status', 'sent').order('created_at').limit(1000),
    supabase.from('email_log').select('dedupe_key, created_at').eq('kind', 'guest_zoom_link').eq('status', 'sent').order('created_at').limit(1000),
    supabase.from('email_log').select('dedupe_key, created_at').eq('kind', 'welcome').eq('status', 'sent').order('created_at').limit(1000),
    // Panelists: the Management list (owner, 2026-11-25), people with an admin login.
    supabase.from('leadership').select('role, sort_order, profile:profiles(id, first_name, last_name, role)').not('profile_id', 'is', null).order('sort_order'),
    supabase.from('profiles').select('id, first_name, last_name').eq('status', 'approved').order('first_name').order('last_name'),
    supabase
      .from('meetings')
      .select('starts_at')
      .eq('category', 'Networking')
      .is('cancelled_reason', null)
      .gt('ends_at', new Date(now).toISOString())
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
  ]);
  if (pendingRes.error || guestsRes.error) throw new Error('Could not load applications and guest requests');
  const lastSent = (rows: { dedupe_key: string; created_at: string }[] | null) =>
    new Map((rows ?? []).map((r) => [r.dedupe_key.split(':')[0], formatShortDate(new Date(r.created_at))]));
  const invitedOn = lastSent(invitesRes.data);
  const zoomSentOn = lastSent(zoomSentRes.data);
  const welcomeOn = lastSent(welcomeRes.data);
  // Guests who have applied: their pending membership application, matched by email.
  const pendingByEmail = new Map(
    pendingRes.data.flatMap((p) => {
      const c = firstOf(p.member_contacts);
      return c?.email ? [[c.email.toLowerCase(), { id: p.id, name: `${p.first_name} ${p.last_name}` }] as const] : [];
    }),
  );
  const guests = guestsRes.data;

  // Members who joined through the guest list: their account, for "Welcome email sent".
  const joinedEmails = guests.filter((g) => g.status === 'joined').map((g) => g.email.toLowerCase());
  const { data: joinedContacts } = joinedEmails.length
    ? await supabase
        .from('member_contacts')
        .select('profile_id, email')
        .in('email', [...new Set([...joinedEmails, ...guests.filter((g) => g.status === 'joined').map((g) => g.email)])])
    : { data: [] };
  const memberByEmail = new Map((joinedContacts ?? []).map((c) => [c.email.toLowerCase(), c.profile_id]));

  // Panel interviews: panelists, proposed times and who can make them.
  const { data: panels } = guests.length
    ? await supabase
        .from('panel_interviews')
        .select(
          'id, guest_id, panelist_ids, status, scheduled_at, guest_emailed_at, guest_email_dismissed_at, panel_interview_slots(id, starts_at, panel_interview_answers(profile_id, answer))',
        )
        .in(
          'guest_id',
          guests.map((g) => g.id),
        )
    : { data: [] };
  const panelistIds = [...new Set((panels ?? []).flatMap((p) => p.panelist_ids))];
  const { data: panelPeople } = panelistIds.length ? await supabase.from('profiles').select('id, first_name, last_name').in('id', panelistIds) : { data: [] };
  const personName = new Map((panelPeople ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
  const panelByGuest = new Map<string, PanelSummary>();
  for (const p of panels ?? []) {
    const slots = p.panel_interview_slots ?? [];
    const answers = slots.flatMap((s) => (s.panel_interview_answers ?? []).map((a) => ({ slotId: s.id, profileId: a.profile_id, answer: a.answer })));
    const best = rankSlots(
      slots.map((s) => ({ id: s.id, startsAt: s.starts_at })),
      p.panelist_ids,
      answers,
    )[0];
    panelByGuest.set(p.guest_id, {
      id: p.id,
      status: p.status,
      when: p.scheduled_at ? formatSlot(new Date(p.scheduled_at)) : null,
      panelists: p.panelist_ids.map((id) => ({ id, name: personName.get(id) ?? 'Former member', answered: answers.some((a) => a.profileId === id) })),
      best: best ? { label: formatSlot(new Date(best.startsAt)), allYes: best.allYes, slotId: best.id } : null,
      guestEmailed: !!p.guest_emailed_at,
      guestEmailDismissed: !!p.guest_email_dismissed_at,
    });
  }

  const cards: (BoardGuest & { declinedOn: string | null; survey: (typeof guests)[number]['guest_surveys']; createdAt: string })[] = guests.map((g) => {
    const memberId = memberByEmail.get(g.email.toLowerCase()) ?? null;
    return {
      id: g.id,
      name: `${g.first_name} ${g.last_name}`,
      business: g.business_name,
      email: g.email,
      phone: g.phone,
      website: g.website,
      about: g.business_description,
      invitedBy: g.invited_by_text,
      requestedOn: formatShortDate(new Date(g.created_at)),
      createdAt: g.created_at,
      changedAt: g.stage_changed_at ?? g.created_at,
      stage: isGuestStage(g.pipeline_stage) ? g.pipeline_stage : 'review',
      status: g.status,
      signedIn: g.source === 'meeting_sign_in',
      addedByHand: !!g.added_by,
      accepted: !!g.accepted_at || !!zoomSentOn.get(g.id),
      declined: g.declined_at ? { called: !!g.decline_called_at } : null,
      declinedOn: g.declined_at ? formatShortDate(new Date(g.declined_at)) : null,
      zoomSentOn: zoomSentOn.get(g.id) ?? null,
      zoomDismissed: !!g.zoom_email_dismissed_at,
      formSentOn: invitedOn.get(g.id) ?? null,
      interviewDone: !!g.one_on_ones_done_at,
      panel: panelByGuest.get(g.id) ?? null,
      membershipDeclined: g.membership_declined_at ? { called: !!g.membership_called_at } : null,
      welcomeSentOn: memberId ? (welcomeOn.get(memberId) ?? null) : null,
      welcomeDismissed: !!g.welcome_email_dismissed_at,
      applicantId: pendingByEmail.get(g.email.toLowerCase())?.id ?? null,
      survey: g.guest_surveys,
    };
  });
  // Board: everyone not rejected; approved members for 60 days.
  const board = cards.filter((c) => !c.declined && (c.stage !== 'approved' || new Date(c.changedAt).getTime() >= now - 60 * 86400000));
  const declined = cards.filter((c) => c.declined).slice(0, 30);
  const list = cards.slice(0, 60);

  const panelists: PanelistOption[] = [];
  for (const l of leadersRes.data ?? []) {
    const p = firstOf(l.profile) as { id: string; first_name: string; last_name: string; role: string } | null;
    if (p && p.role === 'admin' && !panelists.some((x) => x.id === p.id)) panelists.push({ id: p.id, name: `${p.first_name} ${p.last_name}`, role: l.role });
  }
  const nextMeeting = nextRes.data ? formatShortDate(new Date(nextRes.data.starts_at)) : null;
  const members = (membersRes.data ?? []).map((m) => ({ id: m.id, name: `${m.first_name} ${m.last_name}` }));

  return (
    <GuestStepsProvider panelists={panelists} nextMeeting={nextMeeting}>
      <section id="board" className="flex scroll-mt-24 flex-col gap-3" aria-labelledby="board-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="board-h" className="font-display m-0 text-[22px] font-extrabold">
            Guest board
          </h2>
          <AddGuestForm members={members} />
        </div>
        <p className="text-ink-muted m-0 text-sm">
          Every guest from invite request to approved member. No email is ever sent by itself: each one asks you first, and an email you don’t send leaves a
          reminder (⏰) in its step. <strong>Undo</strong> moves a guest back one column. To move a card by hand, drag it to another column or use{' '}
          <strong>Move to</strong> under “Contact &amp; move”.
        </p>
        <GuestBoard guests={board} />
        {declined.length ? (
          <details className="border-line rounded-xl border p-3">
            <summary className="cursor-pointer font-bold">Rejected ({declined.length})</summary>
            <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
              {declined.map((d) => (
                <li key={d.id} className="border-line-soft flex flex-wrap items-start justify-between gap-2 border-b pb-2 last:border-b-0">
                  <div className="min-w-0 text-sm">
                    <strong className="text-heading">{d.name}</strong>
                    {d.business ? ` · ${d.business}` : ''}
                    <div className="text-ink-muted">Rejected {d.declinedOn}</div>
                  </div>
                  <div className="min-w-[220px]">
                    <StepCell g={d} step="accept" />
                  </div>
                </li>
              ))}
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
                    <ApproveApplicantButton profileId={p.id} name={`${p.first_name} ${p.last_name}`} />
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
          The same steps as the guest board, one column each, with a progress bar per guest. Contact details are under each name. Nothing is emailed until you
          confirm it in the pop-up; an email you don’t send leaves a reminder (⏰) in its column.
        </p>
        {list.length === 0 ? (
          <EmptyState title="No guest requests yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Guest invite requests, one column per step</caption>
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  {GUEST_STEPS.map((s) => (
                    <th key={s} scope="col">
                      {guestStepLabels[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((g) => (
                  <tr key={g.id}>
                    <td className="min-w-[230px] align-top">
                      <div className="flex flex-col gap-1.5">
                        <strong className="text-heading">{g.name}</strong>
                        {g.business ? <span className="text-ink-muted text-sm">{g.business}</span> : null}
                        <GuestProgress g={g} />
                        {/* Owner, 2026-11-25: email, phone, invited by and requested under the name instead of their own columns. */}
                        <details className="text-sm">
                          <summary className="cursor-pointer font-semibold">Details</summary>
                          <dl className="m-0 mt-1 flex max-w-[34ch] flex-col gap-1">
                            <div>
                              <dt className="inline font-semibold">Email: </dt>
                              <dd className="inline break-all">
                                <a href={`mailto:${g.email}`}>{g.email}</a>
                              </dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">Phone: </dt>
                              <dd className="inline">{g.phone ?? '—'}</dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">Invited by: </dt>
                              <dd className="inline">{g.invitedBy ?? '—'}</dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">Requested: </dt>
                              <dd className="inline">{g.requestedOn}</dd>
                            </div>
                            {g.website ? (
                              <div>
                                <dt className="inline font-semibold">Website: </dt>
                                <dd className="inline break-all">
                                  <a href={g.website} target="_blank" rel="noopener noreferrer">
                                    {g.website.replace(/^https?:\/\//i, '')}
                                  </a>
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                          {g.signedIn || g.addedByHand ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {g.signedIn ? <Pill tone="teal">Signed in at the meeting</Pill> : null}
                              {g.addedByHand ? <Pill tone="teal">Added by hand</Pill> : null}
                            </div>
                          ) : null}
                        </details>
                        {g.about ? (
                          <details className="text-sm">
                            <summary className="cursor-pointer">About their business</summary>
                            <p className="m-0 mt-1 max-w-[36ch] whitespace-pre-line">{g.about}</p>
                          </details>
                        ) : null}
                        <SurveyAnswers survey={g.survey} />
                        <UndoStep g={g} />
                      </div>
                    </td>
                    {GUEST_STEPS.map((s) => {
                      const st = g.declined ? (s === 'accept' ? 'declined' : 'off') : stepState(g.stage, s);
                      // The top edge of each step cell is one part of the guest's progress bar.
                      const bar = st === 'declined' ? 'border-t-red' : st === 'done' ? 'border-t-teal' : st === 'current' ? 'border-t-accent' : 'border-t-line';
                      return (
                        <td key={s} className={`min-w-[170px] border-t-4 align-top ${bar}`}>
                          <StepCell g={g} step={s} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </GuestStepsProvider>
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
