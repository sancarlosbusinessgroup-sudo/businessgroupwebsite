'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { inviteToApply, sendZoomLink } from '@/app/actions/admin';
import {
  acceptGuest,
  approveApplicant,
  approveMembership,
  confirmPanelSlot,
  declineGuest,
  declineMembership,
  dismissPanelEmail,
  dismissWelcomeEmail,
  dismissZoomEmail,
  markDeclineCalled,
  markFirstZoomDone,
  markMembershipCalled,
  reopenGuest,
  schedulePanel,
  sendPanelEmails,
  sendMemberWelcome,
  sendWelcomeEmail,
  setPanelDone,
  undoGuestStep,
} from '@/app/actions/guests';
import { Pill } from '@/components/ui';
import {
  GUEST_STEPS,
  guestProgress,
  guestReminders,
  stageStepLabel,
  guestStepLabels,
  previousStage,
  stageRank,
  stepState,
  type GuestFlow,
  type GuestStep,
} from '@/lib/guest-pipeline';
import { idle, type ActionState } from '@/lib/validation';

// Guest steps (owner, 2026-11-25) on the guest invite requests list: one cell per step with its
// buttons, state and reminders. No email is sent without a confirm in a pop-up, and every step can be undone.

export type GuestCardData = GuestFlow & {
  id: string;
  email: string;
  /** Their pending membership application, for "See application". */
  applicantId: string | null;
};

export type PanelistOption = { id: string; name: string; role: string };

/** One row of the guest invite requests list. */
export type GuestRow = GuestCardData & {
  business: string | null;
  website: string | null;
  about: string | null;
  invitedBy: string | null;
  requestedOn: string;
  changedAt: string;
  signedIn: boolean;
  addedByHand: boolean;
};

type Ask =
  | { kind: 'zoom' | 'form'; g: GuestCardData }
  /** `profileId`: approved from Pending applications (no guest card). */
  | { kind: 'welcome'; g: { id: string; name: string }; profileId?: string }
  | { kind: 'panel_email'; g: { id: string; name: string }; interviewId: string }
  | { kind: 'reject' | 'membership_reject' | 'schedule' | 'undo'; g: GuestCardData };

type Ctx = {
  ask: (a: Ask) => void;
  /** Runs an action that returns a message; the result is shown at the bottom of the screen. */
  run: (g: { id: string; name: string }, fn: (p: ActionState, fd: FormData) => Promise<ActionState>, fd: FormData) => Promise<ActionState>;
  pending: boolean;
};

const GuestStepsContext = createContext<Ctx | null>(null);

function useSteps(): Ctx {
  const c = useContext(GuestStepsContext);
  if (!c) throw new Error('GuestStepsProvider missing');
  return c;
}

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

/** One pop-up for the whole page, so it survives a card moving to another column. */
export function GuestStepsProvider({ panelists, nextMeeting, children }: { panelists: PanelistOption[]; nextMeeting: string | null; children: ReactNode }) {
  const router = useRouter();
  const [asking, setAsking] = useState<Ask | null>(null);
  const [notice, setNotice] = useState<ActionState & { who?: string }>(idle);
  const [pending, startTransition] = useTransition();

  const run: Ctx['run'] = (g, fn, fd) =>
    new Promise((resolve) => {
      startTransition(async () => {
        const r = await fn(idle, fd);
        setNotice({ ...r, who: g.name });
        router.refresh();
        // A step that has an email after it asks about the email next (never sends it by itself).
        const next = r.status === 'success' ? r.values?.ask : undefined;
        if (next === 'welcome') setAsking({ kind: 'welcome', g, profileId: r.values?.profileId });
        else if (next === 'zoom' && 'stage' in g) setAsking({ kind: 'zoom', g: g as GuestCardData });
        else if (next === 'panel_email' && r.values?.interviewId) setAsking({ kind: 'panel_email', g, interviewId: r.values.interviewId });
        else setAsking(null);
        resolve(r);
      });
    });

  return (
    <GuestStepsContext.Provider value={{ ask: setAsking, run, pending }}>
      {children}
      {/* Keyed so each question starts with an empty note and the panelists box ticked. */}
      <AskDialog
        key={asking ? `${asking.kind}:${asking.g.id}` : 'none'}
        asking={asking}
        close={() => setAsking(null)}
        panelists={panelists}
        nextMeeting={nextMeeting}
      />
      {notice.status !== 'idle' && notice.message ? (
        <div
          role={notice.status === 'error' ? 'alert' : 'status'}
          className={`fixed right-4 bottom-4 z-50 flex max-w-[min(520px,calc(100vw-32px))] items-start gap-3 rounded-xl border-2 p-3 text-sm font-semibold shadow-lg ${
            notice.status === 'error' ? 'border-red bg-red-tint text-red' : 'border-teal bg-surface text-green-ink'
          }`}
        >
          <span className="min-w-0 flex-1">
            {notice.who ? `${notice.who}: ` : ''}
            {notice.message}
          </span>
          <button type="button" className="text-ink-muted cursor-pointer border-0 bg-transparent p-0 text-sm underline" onClick={() => setNotice(idle)}>
            Close
          </button>
        </div>
      ) : null}
    </GuestStepsContext.Provider>
  );
}

function Modal({ open, close, title, children }: { open: boolean; close: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="guest-step-dialog-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="bg-canvas text-ink m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100%-32px))] max-w-none overflow-y-auto rounded-[20px] border-0 p-0 backdrop:bg-black/60"
    >
      {open ? (
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 id="guest-step-dialog-title" className="font-display m-0 text-[22px] font-extrabold">
            {title}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

function AskDialog({
  asking,
  close,
  panelists,
  nextMeeting,
}: {
  asking: Ask | null;
  close: () => void;
  panelists: PanelistOption[];
  nextMeeting: string | null;
}) {
  const { run, pending } = useSteps();
  const [note, setNote] = useState('');
  const [alsoPanel, setAlsoPanel] = useState(true);
  if (!asking)
    return (
      <Modal open={false} close={close} title="">
        {null}
      </Modal>
    );
  const g = asking.g;
  const first = g.name.split(' ')[0];
  const later = (
    <button type="button" className="btn btn-outline" onClick={close} disabled={pending}>
      Not now
    </button>
  );
  const actions = (children: ReactNode) => <div className="flex flex-wrap gap-2">{children}</div>;
  const reminder = (step: string) => <p className="text-ink-muted m-0 text-sm">Not now leaves a reminder in the {step} step, so you can send it later.</p>;

  switch (asking.kind) {
    case 'zoom':
      return (
        <Modal open close={close} title={`Send the Zoom link email to ${first}?`}>
          <p className="m-0">
            {g.name} gets the Zoom link for {nextMeeting ? `the ${nextMeeting} meeting` : 'the next meeting'} by email.
          </p>
          {reminder('Zoom Link')}
          {actions(
            <>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(g, sendZoomLink, form({ id: g.id })).then(close)}>
                {pending ? 'Sending…' : 'Send email'}
              </button>
              {later}
            </>,
          )}
        </Modal>
      );
    case 'form':
      return (
        <Modal open close={close} title={`Email the application form to ${first}?`}>
          <p className="m-0">{g.name} gets a link to the membership application form, already filled in with their name and email.</p>
          {reminder('Application Form')}
          {actions(
            <>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(g, inviteToApply, form({ id: g.id })).then(close)}>
                {pending ? 'Sending…' : 'Send email'}
              </button>
              {later}
            </>,
          )}
        </Modal>
      );
    case 'welcome':
      return (
        <Modal open close={close} title={`Send the welcome email to ${first}?`}>
          <p className="m-0">{g.name} gets the welcome email with the link to set up their profile, and joins the members’ newsletter list.</p>
          {reminder('Membership Approved')}
          {actions(
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  (asking.profileId ? run(g, sendMemberWelcome, form({ profileId: asking.profileId })) : run(g, sendWelcomeEmail, form({ id: g.id }))).then(
                    close,
                  )
                }
              >
                {pending ? 'Sending…' : 'Send email'}
              </button>
              {later}
            </>,
          )}
        </Modal>
      );
    case 'panel_email':
      return (
        <Modal open close={close} title={`Email ${first} the interview time?`}>
          <p className="m-0">{g.name} gets the date, time, how long it takes, how it happens and who is on the panel.</p>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={alsoPanel} onChange={(e) => setAlsoPanel(e.target.checked)} />
            Also email the three panelists the confirmed time
          </label>
          {reminder('Panel Interview')}
          {actions(
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => run(g, sendPanelEmails, form({ interviewId: asking.interviewId, ...(alsoPanel ? { panelists: 'on' } : {}) })).then(close)}
              >
                {pending ? 'Sending…' : 'Send email'}
              </button>
              {later}
            </>,
          )}
        </Modal>
      );
    case 'reject':
    case 'membership_reject': {
      const membership = asking.kind === 'membership_reject';
      return (
        <Modal open close={close} title={membership ? `Not approve ${first}’s membership?` : `Reject ${first}?`}>
          <p className="m-0">
            <strong>No email is sent.</strong> {asking.g.phone ? `Their phone number (${asking.g.phone}) stays here` : 'A reminder stays here'} with a reminder
            to call them.
          </p>
          <div>
            <label className="label" htmlFor="reject-note">
              Note (only admins see it)
            </label>
            <textarea
              id="reject-note"
              className="field min-h-[72px]"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why"
            />
          </div>
          {actions(
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => run(g, membership ? declineMembership : declineGuest, form({ id: g.id, note })).then(close)}
              >
                {pending ? 'Saving…' : membership ? 'Not approved' : 'Reject'}
              </button>
              <button type="button" className="btn btn-outline" onClick={close}>
                Cancel
              </button>
            </>,
          )}
        </Modal>
      );
    }
    case 'undo': {
      const back = previousStage(asking.g.stage);
      return (
        <Modal open close={close} title={`Undo: take back ${first}’s membership approval?`}>
          <p className="m-0">
            Their account goes back to pending, so they leave the members’ directory until they are approved again. The card moves back to{' '}
            {back ? stageStepLabel(back) : 'the previous step'}. No email is sent.
          </p>
          {actions(
            <>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(g, undoGuestStep, form({ id: g.id })).then(close)}>
                Undo approval
              </button>
              <button type="button" className="btn btn-outline" onClick={close}>
                Cancel
              </button>
            </>,
          )}
        </Modal>
      );
    }
    case 'schedule':
      return (
        <Modal open close={close} title={`Schedule ${first}’s panel interview`}>
          <ScheduleForm g={asking.g} panelists={panelists} close={close} />
        </Modal>
      );
  }
}

/** Default times: the next three weekdays at 10 AM (Pacific wall clock, as datetime-local wants). */
function defaultTimes(): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < 3) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const day = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    out.push(`${day}T10:00`);
  }
  return out;
}

function ScheduleForm({ g, panelists, close }: { g: GuestCardData; panelists: PanelistOption[]; close: () => void }) {
  const { run, pending } = useSteps();
  const [times, setTimes] = useState<string[]>(defaultTimes);
  const [chosen, setChosen] = useState<string[]>(['', '', '']);
  const [error, setError] = useState<string | null>(null);
  const submit = async (fd: FormData) => {
    setError(null);
    fd.set('guestId', g.id);
    const r = await run(g, schedulePanel, fd);
    if (r.status === 'success') close();
    else setError(r.message ?? 'Something went wrong.');
  };
  return (
    <form action={submit} className="flex flex-col gap-4">
      <p className="text-ink-soft m-0 text-sm">
        1. Choose three people from Management. 2. Offer a few times. 3. Each of them marks the times they can make on the interview page. As soon as one time
        works for all three, confirm it, and you’ll be asked whether to email {g.name.split(' ')[0]}.
      </p>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 font-bold">Panel</legend>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <label className="label m-0 text-[13px]" htmlFor={`panelist-${i}`}>
              Panelist {i + 1}
            </label>
            <select
              id={`panelist-${i}`}
              name="panelist"
              className="field"
              required
              value={chosen[i]}
              onChange={(e) => setChosen((c) => c.map((x, n) => (n === i ? e.target.value : x)))}
            >
              <option value="">Choose…</option>
              {panelists.map((p) => (
                <option key={p.id} value={p.id} disabled={chosen.includes(p.id) && chosen[i] !== p.id}>
                  {p.name}
                  {p.role ? ` · ${p.role}` : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 font-bold">Times that might work (Pacific time)</legend>
        {times.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`time-${i}`}>
              Time option {i + 1}
            </label>
            <input
              id={`time-${i}`}
              name="time"
              type="datetime-local"
              step={900}
              className="field"
              value={t}
              onChange={(e) => setTimes((ts) => ts.map((x, n) => (n === i ? e.target.value : x)))}
            />
            {times.length > 1 ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTimes((ts) => ts.filter((_, n) => n !== i))}>
                Remove<span className="sr-only"> time option {i + 1}</span>
              </button>
            ) : null}
          </div>
        ))}
        {times.length < 8 ? (
          <button type="button" className="btn btn-outline btn-sm self-start" onClick={() => setTimes((ts) => [...ts, ''])}>
            Add another time
          </button>
        ) : null}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="panel-minutes">
            How long
          </label>
          <select id="panel-minutes" name="minutes" className="field" defaultValue="30">
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="panel-format">
            How
          </label>
          <select id="panel-format" name="format" className="field" defaultValue="zoom">
            <option value="zoom">On Zoom</option>
            <option value="phone">By phone</option>
            <option value="in_person">In person</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="panel-location">
          Zoom link, phone number or address (optional)
        </label>
        <input id="panel-location" name="location" className="field" maxLength={300} />
      </div>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="notify" defaultChecked className="h-5 w-5" />
        Email the three panelists to ask which times they can make
      </label>
      <p className="text-ink-muted m-0 text-sm">Nothing is sent to {g.name.split(' ')[0]} now.</p>
      {error ? (
        <p role="alert" className="text-red m-0 text-sm font-semibold">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Start scheduling'}
        </button>
        <button type="button" className="btn btn-outline" onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- Step cells ------------------------------------------------------------------------------------------------------

function Btn({ children, onClick, primary = false, sr }: { children: ReactNode; onClick: () => void; primary?: boolean; sr?: string }) {
  const { pending } = useSteps();
  return (
    <button type="button" className={`btn btn-sm ${primary ? 'btn-primary' : 'btn-outline'}`} onClick={onClick} disabled={pending}>
      {children}
      {sr ? <span className="sr-only"> {sr}</span> : null}
    </button>
  );
}

/** A small text button posting a void action (Called them, Not needed, Undo). */
function LinkForm({ action, fields, children }: { action: (fd: FormData) => Promise<void>; fields: Record<string, string>; children: ReactNode }) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold underline">
        {children}
      </button>
    </form>
  );
}

function Reminder({ tone, children }: { tone: 'red' | 'amber' | 'teal'; children: ReactNode }) {
  const cls = { red: 'border-red bg-red-tint text-red', amber: 'border-amber bg-amber-tint text-amber', teal: 'border-teal bg-teal-tint text-teal-hover' }[
    tone
  ];
  return (
    <p className={`m-0 rounded-lg border-l-4 px-2 py-1 text-[13px] font-semibold ${cls}`}>
      <span aria-hidden="true">⏰ </span>
      <span className="sr-only">Reminder: </span>
      {children}
    </p>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-ink-muted text-sm">{children}</span>;

/** What one step shows for a guest: its state, buttons and reminders. */
export function StepCell({ g, step }: { g: GuestCardData; step: GuestStep }) {
  const { ask, run } = useSteps();
  const reminders = guestReminders(g).filter((r) => r.step === step);
  const state = stepState(g.stage, step);
  const reached = (s: Parameters<typeof stageRank>[0]) => stageRank(g.stage) >= stageRank(s);
  const tel = g.phone ? (
    <a href={`tel:${g.phone.replace(/[^\d+]/g, '')}`} className="font-bold">
      {g.phone}
    </a>
  ) : (
    <Muted>No phone number</Muted>
  );
  const body: ReactNode[] = [];

  switch (step) {
    case 'accept':
      if (g.declined) {
        body.push(
          <Pill key="p" tone="red">
            Rejected
          </Pill>,
          <span key="t">Call: {tel}</span>,
        );
        body.push(
          g.declined.called ? (
            <LinkForm key="c" action={markDeclineCalled} fields={{ id: g.id, undo: '1' }}>
              Called ✓ (undo)
            </LinkForm>
          ) : (
            <LinkForm key="c" action={markDeclineCalled} fields={{ id: g.id }}>
              I called them
            </LinkForm>
          ),
          <LinkForm key="u" action={reopenGuest} fields={{ id: g.id }}>
            Undo reject
          </LinkForm>,
        );
      } else if (g.stage === 'review') {
        body.push(
          <div key="b" className="flex flex-wrap gap-2">
            <Btn primary onClick={() => run(g, acceptGuest, form({ id: g.id }))} sr={g.name}>
              Accept
            </Btn>
            <Btn onClick={() => ask({ kind: 'reject', g })} sr={g.name}>
              Reject
            </Btn>
          </div>,
        );
      } else
        body.push(
          <Pill key="p" tone="green">
            Accepted
          </Pill>,
        );
      break;

    case 'zoom':
      if (g.declined || state === 'todo') break;
      body.push(
        g.status === 'requested' ? (
          <Pill key="p" tone="gray">
            First Zoom pending
          </Pill>
        ) : (
          <Pill key="p" tone="green">
            First Zoom Done
          </Pill>
        ),
      );
      if (g.zoomSentOn) body.push(<Muted key="s">Link sent {g.zoomSentOn}</Muted>);
      else if (g.zoomDismissed)
        body.push(
          <Muted key="s">Link email not needed</Muted>,
          <LinkForm key="u" action={dismissZoomEmail} fields={{ id: g.id, undo: '1' }}>
            Undo
          </LinkForm>,
        );
      if (g.status === 'requested') {
        body.push(
          <div key="b" className="flex flex-wrap gap-2">
            <Btn primary onClick={() => run(g, markFirstZoomDone, form({ id: g.id }))} sr={`for ${g.name}`}>
              First Zoom Done
            </Btn>
            <Btn onClick={() => ask({ kind: 'zoom', g })} sr={`to ${g.name}`}>
              {g.zoomSentOn ? 'Send again' : 'Send Zoom link'}
            </Btn>
          </div>,
        );
        if (!g.zoomSentOn && !g.zoomDismissed)
          body.push(
            <LinkForm key="d" action={dismissZoomEmail} fields={{ id: g.id }}>
              Not needed (they already have the link)
            </LinkForm>,
          );
      }
      break;

    case 'form':
      if (g.declined || !reached('send_application')) break;
      if (g.status === 'applied' || g.status === 'joined') {
        body.push(
          <Pill key="p" tone="green">
            Application returned
          </Pill>,
        );
        if (g.applicantId)
          body.push(
            <a key="a" href={`#application-${g.applicantId}`} className="text-sm font-bold">
              See application<span className="sr-only"> of {g.name}</span>
            </a>,
          );
      } else {
        body.push(
          g.formSentOn ? (
            <Pill key="p" tone="teal">
              Form sent {g.formSentOn}
            </Pill>
          ) : (
            <Pill key="p" tone="gray">
              Form not sent
            </Pill>
          ),
        );
        body.push(
          <Btn key="b" primary={!g.formSentOn} onClick={() => ask({ kind: 'form', g })} sr={`to ${g.name}`}>
            {g.formSentOn ? 'Send again' : 'Send Form'}
          </Btn>,
        );
        if (g.formSentOn) body.push(<Muted key="w">Waiting for them to send it back</Muted>);
      }
      break;

    case 'panel': {
      if (g.declined || !reached('application_done')) break;
      const p = g.panel;
      if (!p) {
        body.push(
          <Btn key="b" primary onClick={() => ask({ kind: 'schedule', g })} sr={`for ${g.name}`}>
            Schedule Panel Interview
          </Btn>,
        );
      } else if (p.status === 'scheduling') {
        const answered = p.panelists.filter((x) => x.answered).length;
        body.push(
          <Muted key="s">
            Choosing a time · {answered} of {p.panelists.length} answered
          </Muted>,
        );
        if (p.best)
          body.push(
            <Muted key="best">
              Best so far: {p.best.label}
              {p.best.allYes ? ' (all three ✓)' : ''}
            </Muted>,
          );
        body.push(
          <Link key="o" href={`/admin/panel/${p.id}`} className="btn btn-outline btn-sm self-start">
            {p.best?.allYes ? 'Confirm the time' : 'Open the scheduler'}
            <span className="sr-only"> for {g.name}</span>
          </Link>,
        );
      } else {
        body.push(
          <strong key="w" className="text-heading text-sm">
            {p.when}
          </strong>,
        );
        if (p.guestEmailed) body.push(<Muted key="e">Time emailed to {g.name.split(' ')[0]}</Muted>);
        else if (!p.guestEmailDismissed)
          body.push(
            <div key="e" className="flex flex-wrap items-center gap-2">
              <Btn onClick={() => ask({ kind: 'panel_email', g, interviewId: p.id })} sr={`(interview time to ${g.name})`}>
                Email the time
              </Btn>
              <LinkForm action={dismissPanelEmail} fields={{ interviewId: p.id }}>
                Not needed
              </LinkForm>
            </div>,
          );
        body.push(
          <Link key="o" href={`/admin/panel/${p.id}`} className="text-sm font-bold">
            Interview details<span className="sr-only"> for {g.name}</span>
          </Link>,
        );
      }
      if (!p && !reached('interview') && !g.interviewDone) break;
      if (g.interviewDone) {
        body.push(
          <Pill key="st" tone="green">
            Panel interview done
          </Pill>,
          <LinkForm key="un" action={async (fd) => void (await setPanelDone(idle, fd))} fields={{ id: g.id, done: 'false' }}>
            Undo done
          </LinkForm>,
        );
      } else if (g.status !== 'joined') {
        body.push(
          <Pill key="st" tone="amber">
            Panel interview pending
          </Pill>,
          <Btn key="dn" onClick={() => run(g, setPanelDone, form({ id: g.id, done: 'true' }))} sr={`for ${g.name}`}>
            Panel interview done
          </Btn>,
        );
      }
      break;
    }

    case 'membership':
      if (g.declined) break;
      if (g.status === 'joined') {
        body.push(
          <Pill key="p" tone="green">
            Approved
          </Pill>,
        );
        if (g.welcomeSentOn) body.push(<Muted key="w">Welcome email sent {g.welcomeSentOn}</Muted>);
        else if (g.welcomeDismissed)
          body.push(
            <Muted key="w">Welcome email not needed</Muted>,
            <LinkForm key="u" action={dismissWelcomeEmail} fields={{ id: g.id, undo: '1' }}>
              Undo
            </LinkForm>,
          );
        else
          body.push(
            <div key="w" className="flex flex-wrap items-center gap-2">
              <Btn primary onClick={() => ask({ kind: 'welcome', g })} sr={`to ${g.name}`}>
                Send welcome email
              </Btn>
              <LinkForm action={dismissWelcomeEmail} fields={{ id: g.id }}>
                Not needed
              </LinkForm>
            </div>,
          );
      } else if (g.membershipDeclined) {
        body.push(
          <Pill key="p" tone="red">
            Not approved
          </Pill>,
          <span key="t">Call: {tel}</span>,
        );
        body.push(
          g.membershipDeclined.called ? (
            <LinkForm key="c" action={markMembershipCalled} fields={{ id: g.id, undo: '1' }}>
              Called ✓ (undo)
            </LinkForm>
          ) : (
            <LinkForm key="c" action={markMembershipCalled} fields={{ id: g.id }}>
              I called them
            </LinkForm>
          ),
        );
      } else if (reached('interview') || g.interviewDone) {
        if (g.applicantId)
          body.push(
            <div key="b" className="flex flex-wrap gap-2">
              <Btn primary onClick={() => run(g, approveMembership, form({ id: g.id }))} sr={`membership of ${g.name}`}>
                Approve
              </Btn>
              <Btn onClick={() => ask({ kind: 'membership_reject', g })} sr={`membership of ${g.name}`}>
                Reject
              </Btn>
            </div>,
          );
        else body.push(<Muted key="w">Waiting for their application</Muted>);
      } else if (reached('application_done')) body.push(<Muted key="w">After the panel interview</Muted>);
      break;
  }

  if (!body.length && !reminders.length) return <Muted>—</Muted>;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {body}
      {reminders.map((r) => (
        <Reminder key={r.text} tone={r.tone}>
          {r.text}
        </Reminder>
      ))}
    </div>
  );
}

/** "Undo: back to …": moves the guest back one column, taking back what moved them on. */
export function UndoStep({ g }: { g: GuestCardData }) {
  const { ask, run, pending } = useSteps();
  if (g.declined) return null;
  if (g.membershipDeclined)
    return (
      <button
        type="button"
        className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold underline"
        disabled={pending}
        onClick={() => run(g, undoGuestStep, form({ id: g.id }))}
      >
        Undo “not approved”<span className="sr-only"> for {g.name}</span>
      </button>
    );
  const back = previousStage(g.stage);
  if (!back) return null;
  return (
    <button
      type="button"
      className="text-teal-text cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold underline"
      disabled={pending}
      onClick={() => (g.stage === 'approved' && g.status === 'joined' ? ask({ kind: 'undo', g }) : run(g, undoGuestStep, form({ id: g.id })))}
    >
      ↩ Undo: {g.stage === 'application_done' ? 'application form not back yet' : `back to ${stageStepLabel(back)}`}
      <span className="sr-only"> ({g.name})</span>
    </button>
  );
}

/** Five-part progress bar: one part per step, filled as the guest moves on. */
export function GuestProgress({ g }: { g: GuestCardData }) {
  const { step, done } = guestProgress(g.stage);
  const label = g.declined ? 'Rejected' : g.stage === 'approved' ? 'Member' : `Step ${step + 1} of 5: ${guestStepLabels[GUEST_STEPS[step]!]}`;
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={`${g.name}: progress`}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={Math.floor(done)}
        aria-valuetext={label}
        className="flex w-full max-w-[220px] gap-0.5"
      >
        {GUEST_STEPS.map((s, i) => {
          const fill = g.declined
            ? 'bg-red-tint'
            : i < Math.floor(done)
              ? 'bg-teal'
              : i === step && done % 1
                ? 'bg-teal/50'
                : i === step
                  ? 'bg-accent'
                  : 'bg-line';
          return <span key={s} className={`h-2 flex-1 rounded-full ${fill}`} />;
        })}
      </div>
      <span className="text-ink-muted text-[12px] font-semibold">{label}</span>
    </div>
  );
}

/** "Confirm this time" on the interview page: the interview is set, then the pop-up asks whether to email the guest. */
export function ConfirmSlotButton({
  g,
  interviewId,
  slotId,
  label,
  primary,
}: {
  g: GuestCardData;
  interviewId: string;
  slotId: string;
  label: string;
  primary: boolean;
}) {
  const { run, pending } = useSteps();
  return (
    <button
      type="button"
      className={`btn btn-sm ${primary ? 'btn-primary' : 'btn-outline'}`}
      disabled={pending}
      onClick={() => run(g, confirmPanelSlot, form({ interviewId, slotId }))}
    >
      Confirm this time<span className="sr-only"> ({label})</span>
    </button>
  );
}

/** "Email the time" on the interview page. */
export function EmailTimeButton({ g, interviewId }: { g: GuestCardData; interviewId: string }) {
  const { ask } = useSteps();
  return (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => ask({ kind: 'panel_email', g, interviewId })}>
      Email {g.name.split(' ')[0]} the time
    </button>
  );
}

/** "Approve" under Pending applications (owner, 2026-11-25): approves, then the pop-up asks about the welcome email. */
export function ApproveApplicantButton({ profileId, name }: { profileId: string; name: string }) {
  const { run, pending } = useSteps();
  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      disabled={pending}
      onClick={() => run({ id: profileId, name }, approveApplicant, form({ profileId }))}
    >
      Approve<span className="sr-only"> {name}</span>
    </button>
  );
}
