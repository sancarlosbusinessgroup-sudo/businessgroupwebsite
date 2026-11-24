import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notice, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatShortDate, formatSlot } from '@/lib/dates';
import { isGuestStage, rankSlots, type PanelAnswer } from '@/lib/guest-pipeline';
import { createClient } from '@/lib/supabase/server';
import { answerPanelSlot, cancelPanel, dismissPanelEmail, reopenPanelScheduling, removePanelSlot } from '../../../actions/guests';
import { ConfirmSlotButton, EmailTimeButton, GuestStepsProvider, type GuestCardData } from '../../GuestSteps';
import { AddSlotForm } from './AddSlotForm';

export const metadata: Metadata = { title: 'Panel interview', robots: { index: false } };

const formatWords = { zoom: 'On Zoom', phone: 'By phone', in_person: 'In person' } as const;
const answerWords: Record<PanelAnswer, string> = { yes: 'Yes', maybe: 'If needed', no: 'No' };
const answerMark: Record<PanelAnswer, string> = { yes: '✓', maybe: '?', no: '✗' };

/**
 * A guest's panel interview (owner, 2026-11-25): the three panelists each mark the times they can make, the best times
 * rise to the top (three ✓ first), any admin confirms one, and only then is the guest emailed, after a confirm.
 */
export default async function PanelInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const db = await createClient();
  const { data: iv } = await db
    .from('panel_interviews')
    .select(
      'id, guest_id, panelist_ids, duration_minutes, format, location, status, scheduled_at, guest_emailed_at, guest_email_dismissed_at, created_at, guest:guest_requests(id, first_name, last_name, email, phone, business_name, status, pipeline_stage, one_on_ones_done_at), panel_interview_slots(id, starts_at, panel_interview_answers(profile_id, answer))',
    )
    .eq('id', id)
    .maybeSingle();
  if (!iv) notFound();
  const guest = (Array.isArray(iv.guest) ? iv.guest[0] : iv.guest) as {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    business_name: string | null;
    status: 'requested' | 'visited' | 'applied' | 'joined';
    pipeline_stage: string;
    one_on_ones_done_at: string | null;
  } | null;
  if (!guest) notFound();
  const [{ data: people }, { data: app }] = await Promise.all([
    db.from('profiles').select('id, first_name, last_name').in('id', iv.panelist_ids),
    db
      .from('member_contacts')
      .select('profile_id, profile:profiles(status)')
      .ilike('email', guest.email.replace(/[\\%_]/g, '\\$&'))
      .limit(1)
      .maybeSingle(),
  ]);
  const nameOf = new Map((people ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
  const panel = iv.panelist_ids.map((pid) => ({ id: pid, name: nameOf.get(pid) ?? 'Former member' }));
  const slots = [...(iv.panel_interview_slots ?? [])];
  const answers = slots.flatMap((s) => (s.panel_interview_answers ?? []).map((a) => ({ slotId: s.id, profileId: a.profile_id, answer: a.answer })));
  const ranked = rankSlots(
    slots.map((s) => ({ id: s.id, startsAt: s.starts_at })),
    iv.panelist_ids,
    answers,
  );
  const byTime = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const best = ranked[0] ?? null;
  const isPanelist = iv.panelist_ids.includes(viewer.userId);
  const answerOf = (slotId: string, pid: string) => answers.find((a) => a.slotId === slotId && a.profileId === pid)?.answer ?? null;
  const myMissing = isPanelist ? byTime.filter((s) => !answerOf(s.id, viewer.userId)).length : 0;
  const scheduled = iv.status === 'scheduled' && iv.scheduled_at;
  const name = `${guest.first_name} ${guest.last_name}`;
  const appProfile = app ? (Array.isArray(app.profile) ? app.profile[0] : app.profile) : null;

  const g: GuestCardData = {
    id: guest.id,
    name,
    email: guest.email,
    phone: guest.phone,
    stage: isGuestStage(guest.pipeline_stage) ? guest.pipeline_stage : 'interview',
    status: guest.status,
    accepted: true,
    declined: null,
    zoomSentOn: null,
    zoomDismissed: true,
    formSentOn: null,
    interviewDone: !!guest.one_on_ones_done_at,
    panel: null,
    membershipDeclined: null,
    welcomeSentOn: null,
    welcomeDismissed: true,
    applicantId: appProfile && (appProfile as { status: string }).status === 'pending' ? app!.profile_id : null,
  };

  return (
    <GuestStepsProvider panelists={[]} nextMeeting={null}>
      <div className="bg-canvas">
        <div className="container-site flex flex-col gap-5 pt-8 pb-16">
          <nav aria-label="Breadcrumb" className="text-ink-muted text-sm">
            <Link href="/admin">Admin</Link> / <Link href="/admin/guests#board">Guest Invites &amp; Applications</Link> /{' '}
            <span aria-current="page">Panel interview</span>
          </nav>
          <div className="flex flex-col gap-1">
            <h1 className="font-display m-0 text-[clamp(26px,3.2vw,36px)] font-extrabold">Panel interview: {name}</h1>
            <p className="text-ink-soft m-0">
              {guest.business_name ? `${guest.business_name} · ` : ''}
              {formatWords[iv.format]} · about {iv.duration_minutes} minutes{iv.location ? ` · ${iv.location}` : ''}
            </p>
            <p className="text-ink-muted m-0 text-sm">
              <a href={`mailto:${guest.email}`}>{guest.email}</a>
              {guest.phone ? ` · ${guest.phone}` : ''}
              {g.applicantId ? (
                <>
                  {' · '}
                  <Link href={`/admin/guests#application-${g.applicantId}`}>See application</Link>
                </>
              ) : null}
            </p>
          </div>

          {scheduled ? (
            <section className="card flex flex-col gap-3 p-[22px]" aria-labelledby="set-h">
              <h2 id="set-h" className="font-display m-0 text-[22px] font-extrabold">
                Set for {formatSlot(new Date(iv.scheduled_at!))}
              </h2>
              <p className="m-0">With {panel.map((p) => p.name).join(', ')}.</p>
              {iv.guest_emailed_at ? (
                <Pill tone="green">
                  Time emailed to {guest.first_name} on {formatShortDate(new Date(iv.guest_emailed_at))}
                </Pill>
              ) : iv.guest_email_dismissed_at ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="gray">Email not needed</Pill>
                  <form action={dismissPanelEmail}>
                    <input type="hidden" name="interviewId" value={iv.id} />
                    <input type="hidden" name="undo" value="1" />
                    <button type="submit" className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold underline">
                      Undo
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Notice tone="info">The guest has not been told yet.</Notice>
                  <EmailTimeButton g={g} interviewId={iv.id} />
                  <form action={dismissPanelEmail}>
                    <input type="hidden" name="interviewId" value={iv.id} />
                    <button type="submit" className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold underline">
                      Not needed (told them another way)
                    </button>
                  </form>
                </div>
              )}
              <form action={reopenPanelScheduling}>
                <input type="hidden" name="interviewId" value={iv.id} />
                <button type="submit" className="btn btn-outline btn-sm">
                  Change the time
                </button>
              </form>
            </section>
          ) : (
            <section className="card flex flex-col gap-2 p-[22px]" aria-labelledby="how-h">
              <h2 id="how-h" className="font-display m-0 text-lg font-extrabold">
                How this works
              </h2>
              <ol className="m-0 flex list-decimal flex-col gap-1 pl-6">
                <li>Each of the three panelists marks every time: Yes, If needed, or No.</li>
                <li>The best times rise to the top. A time all three can make is marked “Works for all 3”.</li>
                <li>Anyone on Management confirms that time. You are then asked whether to email {guest.first_name}; nothing is sent before that.</li>
                <li>No time works? Add more times below; the panelists can add times too.</li>
              </ol>
              {isPanelist && myMissing ? (
                <Notice tone="info">
                  You are on this panel: please answer{' '}
                  {myMissing === byTime.length ? 'each time' : `the ${myMissing} time${myMissing === 1 ? '' : 's'} you haven’t answered`} below.
                </Notice>
              ) : null}
            </section>
          )}

          <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="times-h">
            <h2 id="times-h" className="font-display m-0 text-[22px] font-extrabold">
              Times and who can make them
            </h2>
            {best && !scheduled ? (
              <p className="m-0 font-semibold">
                Best so far: {formatSlot(new Date(best.startsAt))}
                {best.allYes
                  ? ' (works for all 3)'
                  : ` (${best.yes} yes${best.maybe ? `, ${best.maybe} if needed` : ''}${best.waiting ? `, ${best.waiting} still to answer` : ''})`}
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Proposed times and each panelist’s answer</caption>
                <thead>
                  <tr>
                    <th scope="col">Time (Pacific)</th>
                    {panel.map((p) => (
                      <th key={p.id} scope="col">
                        {p.name}
                        {p.id === viewer.userId ? ' (you)' : ''}
                      </th>
                    ))}
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byTime.map((s) => {
                    const t = ranked.find((r) => r.id === s.id)!;
                    const isChosen = scheduled && iv.scheduled_at && new Date(iv.scheduled_at).getTime() === new Date(s.starts_at).getTime();
                    const label = formatSlot(new Date(s.starts_at));
                    return (
                      <tr key={s.id} className={t.allYes ? 'bg-green-tint' : undefined}>
                        <th scope="row" className="text-left whitespace-nowrap">
                          {label}
                          {t.allYes ? (
                            <div className="mt-1">
                              <Pill tone="green">Works for all 3</Pill>
                            </div>
                          ) : null}
                          {isChosen ? (
                            <div className="mt-1">
                              <Pill tone="teal">Confirmed</Pill>
                            </div>
                          ) : null}
                        </th>
                        {panel.map((p) => {
                          const a = answerOf(s.id, p.id);
                          if (p.id === viewer.userId && !scheduled)
                            return (
                              <td key={p.id}>
                                <div className="flex flex-wrap gap-1" role="group" aria-label={`Can you make ${label}?`}>
                                  {(['yes', 'maybe', 'no'] as const).map((ans) => (
                                    <form key={ans} action={answerPanelSlot}>
                                      <input type="hidden" name="slotId" value={s.id} />
                                      <input type="hidden" name="answer" value={ans} />
                                      <button type="submit" className={`btn btn-sm ${a === ans ? 'btn-primary' : 'btn-outline'}`} aria-pressed={a === ans}>
                                        {answerWords[ans]}
                                      </button>
                                    </form>
                                  ))}
                                </div>
                              </td>
                            );
                          return (
                            <td key={p.id}>
                              {a ? (
                                <span className={a === 'yes' ? 'text-green-ink font-bold' : a === 'no' ? 'text-red font-bold' : 'text-amber font-bold'}>
                                  <span aria-hidden="true">{answerMark[a]} </span>
                                  {answerWords[a]}
                                </span>
                              ) : (
                                <span className="text-ink-muted">Not answered</span>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          {!scheduled ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <ConfirmSlotButton g={g} interviewId={iv.id} slotId={s.id} label={label} primary={t.allYes} />
                              <form action={removePanelSlot}>
                                <input type="hidden" name="interviewId" value={iv.id} />
                                <input type="hidden" name="slotId" value={s.id} />
                                <button type="submit" className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-sm underline">
                                  Remove<span className="sr-only"> {label}</span>
                                </button>
                              </form>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!scheduled ? <AddSlotForm interviewId={iv.id} /> : null}
          </section>

          <form action={cancelPanel} className="flex flex-col items-start gap-1">
            <input type="hidden" name="interviewId" value={iv.id} />
            <button type="submit" className="btn btn-outline btn-sm">
              Cancel this panel interview
            </button>
            <span className="text-ink-muted text-sm">To choose other people. Nothing is sent to anyone.</span>
          </form>
          <p className="text-ink-muted m-0 text-sm">Started {formatShortDate(new Date(iv.created_at))}.</p>
        </div>
      </div>
    </GuestStepsProvider>
  );
}
