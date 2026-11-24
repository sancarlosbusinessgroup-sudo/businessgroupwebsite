'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState, useTransition, type DragEvent } from 'react';
import { acceptGuest, addGuestNote, declineGuest, moveGuestStage } from '@/app/actions/guests';
import { setGuestOneOnOnes, setGuestStatus, setMemberStatus } from '@/app/actions/admin';
import { SubmitButton } from '@/components/forms';
import { Pill } from '@/components/ui';
import { GUEST_STAGES, guestStageHints, guestStageLabels, type GuestStage } from '@/lib/guest-pipeline';
import { idle, type ActionState } from '@/lib/validation';
import { InviteToApplyButton } from './InviteToApplyButton';
import { SendZoomLinkButton } from './SendZoomLinkButton';

export type BoardGuest = {
  id: string;
  name: string;
  business: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  about: string | null;
  invitedBy: string | null;
  requestedOn: string;
  changedAt: string;
  stage: GuestStage;
  status: 'requested' | 'visited' | 'applied' | 'joined';
  signedIn: boolean;
  zoomSentOn: string | null;
  formSentOn: string | null;
  interviewDone: boolean;
  /** Their pending membership application (matched by email), for "See application" and "Approve membership". */
  applicantId: string | null;
  history: { at: string; who: string | null; text: string }[];
};

function Message({ state }: { state: ActionState }) {
  if (state.status === 'idle' || !state.message) return null;
  return (
    <p role={state.status === 'error' ? 'alert' : 'status'} className={`m-0 text-sm font-semibold ${state.status === 'error' ? 'text-red' : 'text-green-ink'}`}>
      {state.message}
    </p>
  );
}

type Notify = (name: string, r: ActionState) => void;

function AcceptButton({ g, notify }: { g: BoardGuest; notify: Notify }) {
  // The card moves to another column when this succeeds, so the message is also shown above the board.
  const [, action] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await acceptGuest(prev, fd);
    notify(g.name, r);
    return r;
  }, idle);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={g.id} />
      <SubmitButton pendingText="Accepting…" className="btn btn-primary btn-sm">
        Accept<span className="sr-only"> {g.name} and send the Zoom link</span>
      </SubmitButton>
      <span className="text-ink-muted text-[13px]">Sends the Zoom link</span>
    </form>
  );
}

function DeclineForm({ g, notify }: { g: BoardGuest; notify: Notify }) {
  const [open, setOpen] = useState(false);
  // The card leaves the board when this succeeds, so the message is shown above the board.
  const [, action] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await declineGuest(prev, fd);
    notify(g.name, r);
    return r;
  }, idle);
  if (!open)
    return (
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)} aria-expanded={false}>
        Decline…<span className="sr-only"> {g.name}</span>
      </button>
    );
  return (
    <form action={action} className="border-line flex w-full flex-col gap-2 rounded-xl border p-3" aria-label={`Decline ${g.name}`}>
      <input type="hidden" name="id" value={g.id} />
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-1 text-sm font-bold">How will you tell them?</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="method" value="phone" defaultChecked className="h-5 w-5" /> I’ll call them
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="method" value="email" className="h-5 w-5" /> Send the decline email
        </label>
      </fieldset>
      <label className="label m-0" htmlFor={`dn-${g.id}`}>
        Note (only admins see it)
      </label>
      <textarea id={`dn-${g.id}`} name="note" className="field min-h-[64px]" maxLength={1000} placeholder="Why, and anything said" />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="Declining…" className="btn btn-primary btn-sm">
          Decline
        </SubmitButton>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function NoteForm({ id }: { id: string }) {
  const [state, action] = useActionState(addGuestNote, idle);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <label className="label m-0" htmlFor={`note-${id}`}>
        Add a note
      </label>
      <textarea id={`note-${id}`} name="note" className="field min-h-[56px]" maxLength={1000} />
      <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm self-start">
        Save note
      </SubmitButton>
      <Message state={state} />
    </form>
  );
}

function MoveForm({ g, onMoved, notify }: { g: BoardGuest; onMoved: (stage: GuestStage) => void; notify: Notify }) {
  const [, action] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await moveGuestStage(prev, fd);
    const s = fd.get('stage');
    notify(g.name, r);
    if (r.status === 'success' && typeof s === 'string') onMoved(s as GuestStage);
    return r;
  }, idle);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={g.id} />
      <div className="min-w-0 flex-1">
        <label className="label m-0 text-[13px]" htmlFor={`mv-${g.id}`}>
          Move {g.name} to
        </label>
        <select id={`mv-${g.id}`} name="stage" className="field min-h-11 py-1 text-sm" defaultValue={g.stage}>
          {GUEST_STAGES.map((s) => (
            <option key={s} value={s}>
              {guestStageLabels[s]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pendingText="Moving…" className="btn btn-outline btn-sm">
        Move
      </SubmitButton>
      <div className="w-full"></div>
    </form>
  );
}

function StageActions({ g, notify }: { g: BoardGuest; notify: Notify }) {
  switch (g.stage) {
    case 'review':
      return (
        <div className="flex flex-wrap items-start gap-2">
          <AcceptButton g={g} notify={notify} />
          <DeclineForm g={g} notify={notify} />
        </div>
      );
    case 'zoom_sent':
      return (
        <div className="flex flex-wrap items-start gap-2">
          {g.status === 'requested' ? (
            <form action={setGuestStatus}>
              <input type="hidden" name="id" value={g.id} />
              <input type="hidden" name="status" value="visited" />
              <button type="submit" className="btn btn-primary btn-sm">
                Mark visited<span className="sr-only"> for {g.name}</span>
              </button>
            </form>
          ) : null}
          <SendZoomLinkButton id={g.id} name={g.name} sentOn={g.zoomSentOn} />
        </div>
      );
    case 'send_application':
      return <InviteToApplyButton id={g.id} name={g.name} sentOn={g.formSentOn} />;
    case 'application_done':
    case 'interview':
      return (
        <div className="flex flex-wrap items-start gap-2">
          {g.applicantId ? (
            <a href={`#application-${g.applicantId}`} className="btn btn-outline btn-sm">
              See application<span className="sr-only"> of {g.name}</span>
            </a>
          ) : null}
          <form action={setGuestOneOnOnes}>
            <input type="hidden" name="id" value={g.id} />
            <input type="hidden" name="done" value={g.interviewDone ? 'false' : 'true'} />
            <button type="submit" className={`btn btn-sm ${g.interviewDone ? 'btn-outline' : g.stage === 'interview' ? 'btn-primary' : 'btn-outline'}`}>
              {g.interviewDone ? 'Undo interview done' : 'Interview done'}
              <span className="sr-only"> for {g.name}</span>
            </button>
          </form>
          {g.stage === 'interview' && g.applicantId ? (
            <form action={setMemberStatus}>
              <input type="hidden" name="back" value="/admin/guests" />
              <input type="hidden" name="id" value={g.applicantId} />
              <input type="hidden" name="status" value="approved" />
              <button type="submit" className="btn btn-primary btn-sm">
                Approve membership<span className="sr-only"> of {g.name}</span>
              </button>
            </form>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}

function Card({
  g,
  onMoved,
  onDragStart,
  notify,
}: {
  g: BoardGuest;
  onMoved: (stage: GuestStage) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  notify: Notify;
}) {
  const hints = [
    g.signedIn ? 'Signed in at the meeting' : null,
    g.zoomSentOn ? `Zoom link sent ${g.zoomSentOn}` : null,
    g.formSentOn ? `Form sent ${g.formSentOn}` : null,
    g.interviewDone ? 'Interview done' : null,
  ].filter((x): x is string => !!x);
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, g.id)}
      data-guest-card={g.id}
      className="border-line bg-surface flex cursor-grab flex-col gap-2 rounded-xl border p-3 shadow-sm active:cursor-grabbing"
    >
      <div>
        <strong className="text-heading block">{g.name}</strong>
        {g.business ? <span className="text-ink-soft block text-sm">{g.business}</span> : null}
        <span className="text-ink-muted block text-[13px]">
          Requested {g.requestedOn}
          {g.invitedBy ? ` · invited by ${g.invitedBy}` : ''}
        </span>
      </div>
      {hints.length ? (
        <div className="flex flex-wrap gap-1">
          {hints.map((h) => (
            <Pill key={h} tone={h === 'Interview done' ? 'green' : 'teal'}>
              {h}
            </Pill>
          ))}
        </div>
      ) : null}
      {g.about ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">About their business</summary>
          <p className="m-0 mt-1 whitespace-pre-line">{g.about}</p>
        </details>
      ) : null}
      <StageActions g={g} notify={notify} />
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Details, history &amp; move</summary>
        <div className="mt-2 flex flex-col gap-3">
          <p className="m-0">
            <a href={`mailto:${g.email}`}>{g.email}</a>
            {g.phone ? ` · ${g.phone}` : ''}
            {g.website ? (
              <>
                {' · '}
                <a href={g.website} target="_blank" rel="noopener noreferrer">
                  website<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            ) : null}
          </p>
          <MoveForm g={g} onMoved={onMoved} notify={notify} />
          <div>
            <p className="m-0 font-bold">History</p>
            {g.history.length === 0 ? (
              <p className="text-ink-muted m-0">Nothing yet.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {g.history.map((h, n) => (
                  <li key={n}>
                    <span className="text-ink-muted">{h.at}</span> · {h.text}
                    {h.who ? <span className="text-ink-muted"> · {h.who}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <NoteForm id={g.id} />
        </div>
      </details>
    </li>
  );
}

/**
 * The guest board (owner, 2026-11-24): six columns from "Accept or Reject" to "Membership Approved". Cards move
 * forward by themselves as steps are done on the website; admins can drag a card to another column, or use
 * "Move to" in the card (keyboard and phones). Moving by hand sends no emails and approves no one.
 */
export function GuestBoard({ guests }: { guests: BoardGuest[] }) {
  const router = useRouter();
  const [moved, setMoved] = useState<Record<string, GuestStage>>({});
  const [over, setOver] = useState<GuestStage | null>(null);
  const [message, setMessage] = useState<ActionState>(idle);
  const [, startTransition] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  // While dragging near the left or right edge, scroll the board so far columns can be reached.
  const edgeScroll = (e: DragEvent) => {
    const el = scroller.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (e.clientX < r.left + 70) el.scrollLeft -= 24;
    else if (e.clientX > r.right - 70) el.scrollLeft += 24;
  };
  const stageOf = (g: BoardGuest) => moved[g.id] ?? g.stage;
  const notify: Notify = (name, r) => setMessage(r.status === 'idle' ? r : { ...r, message: r.message ? `${name}: ${r.message}` : r.message });

  const onDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (e: DragEvent, stage: GuestStage) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/plain');
    const g = guests.find((x) => x.id === id);
    if (!g || stageOf(g) === stage) return;
    setMoved((m) => ({ ...m, [id]: stage }));
    const fd = new FormData();
    fd.set('id', id);
    fd.set('stage', stage);
    startTransition(async () => {
      const r = await moveGuestStage(idle, fd);
      notify(g.name, r);
      if (r.status !== 'success') setMoved((m) => ({ ...m, [id]: g.stage }));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Results of accept / decline / move: the card itself may have moved or left the board. */}
      <div aria-live="polite" className="min-h-6">
        <Message state={message} />
      </div>
      {/* Wider than the page on big screens (all six columns side by side); scrolls sideways on smaller ones. */}
      <div
        ref={scroller}
        onDragOver={edgeScroll}
        className="overflow-x-auto pb-2 lg:relative lg:left-1/2 lg:w-[calc(100vw-48px)] lg:max-w-[1640px] lg:-translate-x-1/2"
        role="region"
        aria-label="Guest board columns"
        tabIndex={0}
      >
        <div className="grid min-w-[1180px] grid-cols-6 gap-3">
          {GUEST_STAGES.map((stage, n) => {
            const cards = guests.filter((g) => stageOf(g) === stage).map((g) => ({ ...g, stage }));
            return (
              <section
                key={stage}
                aria-labelledby={`col-${stage}`}
                data-stage={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(stage);
                }}
                onDragLeave={() => setOver((x) => (x === stage ? null : x))}
                onDrop={(e) => onDrop(e, stage)}
                className={`bg-canvas flex min-h-[220px] flex-col gap-2 rounded-2xl border-2 p-3 ${over === stage ? 'border-teal border-dashed' : 'border-line-soft'}`}
              >
                <h3 id={`col-${stage}`} className="font-display text-heading m-0 flex items-center gap-2 text-base font-extrabold">
                  <span className="bg-teal text-on-teal flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px]" aria-hidden>
                    {n + 1}
                  </span>
                  {guestStageLabels[stage]}
                  <span className="text-ink-muted ml-auto text-sm font-semibold">{cards.length}</span>
                </h3>
                <p className="text-ink-muted m-0 text-[13px] leading-snug">{guestStageHints[stage]}</p>
                {cards.length ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {cards.map((g) => (
                      <Card key={g.id} g={g} notify={notify} onDragStart={onDragStart} onMoved={(s) => setMoved((m) => ({ ...m, [g.id]: s }))} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-muted m-0 text-sm">No one here.</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
