'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState, useTransition, type DragEvent } from 'react';
import { moveGuestStage } from '@/app/actions/guests';
import { SubmitButton } from '@/components/forms';
import { Pill } from '@/components/ui';
import { GUEST_STAGES, guestStageHints, guestStageLabels, type GuestStage } from '@/lib/guest-pipeline';
import { idle, type ActionState } from '@/lib/validation';
import { boardSteps, StepCell, UndoStep, type GuestCardData } from './GuestSteps';

export type BoardGuest = GuestCardData & {
  business: string | null;
  website: string | null;
  about: string | null;
  invitedBy: string | null;
  requestedOn: string;
  changedAt: string;
  signedIn: boolean;
  addedByHand: boolean;
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
    </form>
  );
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
  const hints = [g.signedIn ? 'Signed in at the meeting' : null, g.addedByHand ? 'Added by hand' : null].filter((x): x is string => !!x);
  // Owner, 2026-11-25: the business, request date and inviter as bullet points.
  const facts = [g.business, `Requested ${g.requestedOn}`, g.invitedBy ? `Invited by ${g.invitedBy}` : null].filter((x): x is string => !!x);
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, g.id)}
      data-guest-card={g.id}
      className="border-line bg-surface flex cursor-grab flex-col gap-2 rounded-xl border p-3 shadow-sm active:cursor-grabbing"
    >
      <div className="flex flex-col gap-1">
        <strong className="text-heading block">{g.name}</strong>
        <ul className="text-ink-soft m-0 list-disc pl-5 text-[13px] leading-snug">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      {hints.length ? (
        <div className="flex flex-wrap gap-1">
          {hints.map((h) => (
            <Pill key={h} tone="teal">
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
      {boardSteps(g).map((s) => (
        <StepCell key={s} g={g} step={s} />
      ))}
      <UndoStep g={g} />
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Contact &amp; move</summary>
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
          {/* History and notes are hidden for now (owner, 2026-11-25); they are still recorded. */}
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
