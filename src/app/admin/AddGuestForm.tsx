'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addGuestByHand } from '@/app/actions/guests';
import { SubmitButton } from '@/components/forms';
import { guestStageLabels } from '@/lib/guest-pipeline';
import { idle } from '@/lib/validation';

const stages = ['send_application', 'review', 'zoom_sent', 'application_done', 'interview'] as const;
const stageHelp: Record<(typeof stages)[number], string> = {
  review: 'A new invite request: you still accept or reject them.',
  zoom_sent: 'Accepted, not yet been to a Zoom.',
  send_application: 'They have already joined a Zoom (for example with a friend’s link).',
  application_done: 'They have already filled in the application form.',
  interview: 'Their panel interview is next.',
};

/**
 * "Add a guest" (owner, 2026-11-25): for guests a member brought to the Zoom without asking for an invite. One form for
 * every case: choose the step they are at (default Send Application Form; "Accept or Reject" makes it an ordinary
 * invite request). No email is sent.
 */
export function AddGuestForm({ members }: { members: { id: string; name: string }[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        aria-haspopup="dialog"
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
      >
        + Add a guest
      </button>
      <dialog
        ref={ref}
        aria-labelledby="add-guest-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="bg-canvas text-ink m-auto max-h-[calc(100dvh-32px)] w-[min(680px,calc(100%-32px))] max-w-none overflow-y-auto rounded-[20px] border-0 p-0 backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="add-guest-title" className="font-display m-0 text-[clamp(22px,3vw,28px)] font-extrabold">
                Add a guest
              </h2>
              <p className="text-ink-soft m-0">
                For someone who came to the Zoom with a friend’s link, or any guest you want to add yourself. Choose the step they are at. No email is sent.
              </p>
            </div>
            <button type="button" className="btn btn-outline btn-sm flex-none" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {open ? <AddGuestFields key={round} members={members} done={() => setOpen(false)} /> : null}
        </div>
      </dialog>
    </>
  );
}

function AddGuestFields({ members, done }: { members: { id: string; name: string }[]; done: () => void }) {
  const [state, action] = useActionState(addGuestByHand, idle);
  const [stage, setStage] = useState<(typeof stages)[number]>('send_application');
  const v = state.values ?? {};
  const err = state.errors ?? {};
  useEffect(() => {
    if (state.status === 'success') {
      const t = setTimeout(done, 1800);
      return () => clearTimeout(t);
    }
  }, [state, done]);
  const field = (name: string, label: string, opts: { required?: boolean; type?: string; max?: number; auto?: string } = {}) => (
    <div>
      <label className="label" htmlFor={`ag-${name}`}>
        {label}
        {opts.required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={`ag-${name}`}
        name={name}
        type={opts.type ?? 'text'}
        className="field"
        required={opts.required}
        maxLength={opts.max}
        autoComplete={opts.auto ?? 'off'}
        defaultValue={v[name] ?? ''}
        aria-invalid={err[name] ? true : undefined}
        aria-describedby={err[name] ? `ag-${name}-err` : undefined}
      />
      {err[name] ? (
        <p id={`ag-${name}-err`} className="text-red m-0 mt-1 text-sm font-semibold">
          {err[name]}
        </p>
      ) : null}
    </div>
  );
  if (state.status === 'success')
    return (
      <p role="status" className="text-green-ink m-0 font-semibold">
        {state.message}
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 font-bold">Put them in</legend>
        {stages.map((s) => (
          <label key={s} className="flex min-h-11 items-start gap-2">
            <input type="radio" name="stage" value={s} checked={stage === s} onChange={() => setStage(s)} className="mt-1 h-5 w-5 flex-none" />
            <span>
              <strong>{guestStageLabels[s]}</strong>
              {s === 'send_application' ? ' (usual)' : ''}
              <span className="text-ink-muted block text-sm">{stageHelp[s]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        {field('firstName', 'First name', { required: true, max: 60 })}
        {field('lastName', 'Last name', { required: true, max: 60 })}
        {field('email', 'Email', { required: true, type: 'email', max: 254 })}
        {field('phone', 'Phone', { type: 'tel', max: 40 })}
        {field('businessName', 'Business name', { max: 120 })}
        {field('website', 'Website', { max: 300 })}
      </div>
      <div>
        <label className="label" htmlFor="ag-businessDescription">
          About their business
        </label>
        <textarea
          id="ag-businessDescription"
          name="businessDescription"
          className="field min-h-[72px]"
          maxLength={1000}
          defaultValue={v.businessDescription ?? ''}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ag-invitedById">
            Invited by (member)
          </label>
          <select id="ag-invitedById" name="invitedById" className="field" defaultValue={v.invitedById ?? ''}>
            <option value="">Not a member / don’t know</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {field('invitedBy', 'Or who invited them', { max: 120 })}
      </div>
      <div>
        <label className="label" htmlFor="ag-note">
          Note (only admins see it)
        </label>
        <textarea id="ag-note" name="note" className="field min-h-[56px]" maxLength={1000} defaultValue={v.note ?? ''} />
      </div>
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-red m-0 font-semibold">
          {state.message}
        </p>
      ) : null}
      <SubmitButton pendingText="Adding…">Add guest</SubmitButton>
    </form>
  );
}
