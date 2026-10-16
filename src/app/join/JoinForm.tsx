'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { Checkbox, SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { CheckIcon, Notice } from '@/components/ui';
import { commitments } from '@/lib/content';
import { fieldErrors, formToObject, idle, joinAccountSchema, joinBusinessSchema, joinReferralSchema, joinSchema } from '@/lib/validation';
import { signUp } from '../actions/auth';

const STEPS = ['Account', 'Business', 'Referral', 'Done'] as const;
const stepSchemas = [joinAccountSchema, joinBusinessSchema, joinReferralSchema];

type Props = { categories: { id: number; name: string; open: boolean }[]; referralCode?: string; referrerName?: string };

export function JoinForm({ categories, referralCode, referrerName }: Props) {
  const [state, action] = useActionState(signUp, idle);
  const [step, setStep] = useState(0);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const [categoryId, setCategoryId] = useState<string>(state.values?.categoryId ?? '');
  const fullCategory = categories.find((c) => String(c.id) === categoryId && !c.open);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const done = state.status === 'success';
  const current = done ? 3 : step;
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.values ?? {};

  // Server-side errors may belong to an earlier step: jump to the first one with an error.
  const serverErrorStep = state.errors ? stepSchemas.findIndex((s) => Object.keys(state.errors ?? {}).some((k) => k in s.shape)) : -1;
  const shownStep = !clientErrors && serverErrorStep >= 0 && serverErrorStep < step ? serverErrorStep : current;

  function validateStep(i: number): boolean {
    const form = formRef.current;
    if (!form) return false;
    const schema = stepSchemas[i];
    if (!schema) return true;
    const r = schema.safeParse(formToObject(new FormData(form)));
    if (r.success) {
      setClientErrors(null);
      return true;
    }
    const errs = fieldErrors(r.error);
    setClientErrors(errs);
    const first = Object.keys(errs)[0];
    (first ? (form.elements.namedItem(first) as HTMLElement | null) : null)?.focus();
    return false;
  }

  function go(to: number) {
    setStep(to);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  return (
    <div className="border-line bg-surface min-w-0 flex-[999_1_560px] overflow-hidden rounded-[20px] border">
      <ol aria-label="Progress" className="border-line m-0 grid list-none grid-cols-4 border-b p-0">
        {STEPS.map((label, i) => {
          const on = i === shownStep;
          const complete = i < shownStep;
          return (
            <li
              key={label}
              aria-current={on ? 'step' : undefined}
              className={`font-display flex items-center gap-2.5 px-3 py-4 text-sm font-bold sm:px-[18px] ${on ? 'text-heading shadow-[inset_0_-3px_0_var(--teal)]' : 'text-ink-muted'}`}
            >
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] ${on || complete ? 'bg-teal text-on-teal' : 'bg-line-soft text-ink-muted'}`}
              >
                {complete ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
              <span className="sr-only sm:hidden">{label}</span>
            </li>
          );
        })}
      </ol>

      {done ? (
        <div className="flex flex-col items-start gap-4 p-8" role="status">
          <span className="bg-green-tint text-green flex h-14 w-14 items-center justify-center rounded-full">
            <CheckIcon />
          </span>
          <h2 className="font-display m-0 text-[26px]" tabIndex={-1}>
            Application received
          </h2>
          {state.message === 'confirm-email' ? <Notice tone="info">We sent a confirmation link to {v.email}. Click it to activate your account.</Notice> : null}
          <p className="text-ink-soft m-0">
            Your account is a <strong>Guest applicant</strong> until the membership committee approves it. Here&apos;s what happens next:
          </p>
          <ol className="m-0 flex w-full list-none flex-col gap-2.5 p-0">
            <li className="border-line flex justify-between gap-3 rounded-xl border px-4 py-3.5">
              <span>Attend 2 meetings as a guest</span>
            </li>
            <li className="border-line flex justify-between gap-3 rounded-xl border px-4 py-3.5">
              <span>One-on-ones with three membership committee members</span>
            </li>
            <li className="border-line flex justify-between gap-3 rounded-xl border px-4 py-3.5">
              <span>Committee approval</span>
              <strong className="text-ink-muted">Pending</strong>
            </li>
          </ol>
          <Link className="btn btn-primary" href="/login?next=/pending">
            Log in to see your status
          </Link>
        </div>
      ) : (
        <form
          ref={formRef}
          action={action}
          noValidate
          className="flex flex-col gap-5 p-6 sm:p-8"
          onSubmit={(e) => {
            const r = joinSchema.safeParse(formToObject(new FormData(e.currentTarget)));
            if (!r.success) {
              e.preventDefault();
              validateStep(2);
            } else setClientErrors(null);
          }}
        >
          {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}

          <fieldset hidden={shownStep !== 0} className="m-0 flex flex-col gap-4 border-0 p-0">
            <legend className="mb-2 p-0">
              <h2 ref={shownStep === 0 ? headingRef : undefined} tabIndex={-1} className="font-display m-0 text-2xl">
                Create your account
              </h2>
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField name="firstName" label="First name" autoComplete="given-name" required defaultValue={v.firstName} error={errors.firstName} />
              <TextField name="lastName" label="Last name" autoComplete="family-name" required defaultValue={v.lastName} error={errors.lastName} />
              <TextField
                name="email"
                type="email"
                label="Email"
                autoComplete="email"
                required
                defaultValue={v.email}
                error={errors.email}
                help="Use the email you'll use for Zoom."
              />
              <TextField name="phone" type="tel" label="Mobile phone" autoComplete="tel" defaultValue={v.phone} error={errors.phone} />
              <TextField
                name="password"
                type="password"
                label="Password"
                autoComplete="new-password"
                required
                error={errors.password}
                help="At least 8 characters. You can also log in with an emailed code later."
              />
            </div>
          </fieldset>

          <fieldset hidden={shownStep !== 1} className="m-0 flex flex-col gap-4 border-0 p-0">
            <legend className="mb-2 p-0">
              <h2 ref={shownStep === 1 ? headingRef : undefined} tabIndex={-1} className="font-display m-0 text-2xl">
                Your business profile
              </h2>
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                name="businessName"
                label="Business name"
                autoComplete="organization"
                required
                defaultValue={v.businessName}
                error={errors.businessName}
              />
              <SelectField
                name="categoryId"
                label="Category"
                required
                defaultValue={v.categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value)}
                error={errors.categoryId}
                help={
                  fullCategory
                    ? `${fullCategory.name} already has a member, and we keep one member per profession. You can still apply; an admin will contact you about fit.`
                    : 'One member per profession. Categories marked “full” already have a member.'
                }
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.open ? c.name : `${c.name} (full)`}
                  </option>
                ))}
              </SelectField>
              <TextField name="website" type="url" label="Website" placeholder="https://" defaultValue={v.website} error={errors.website} />
              <TextField name="serviceArea" label="Service area" placeholder="e.g. San Mateo County" defaultValue={v.serviceArea} error={errors.serviceArea} />
              <div className="sm:col-span-2">
                <TextArea
                  name="idealClient"
                  label="Who is your ideal client?"
                  defaultValue={v.idealClient}
                  error={errors.idealClient}
                  help="This appears on your profile and helps members refer you. You can add your logo and photo after approval."
                />
              </div>
            </div>
          </fieldset>

          <fieldset hidden={shownStep !== 2} className="m-0 flex flex-col gap-4 border-0 p-0">
            <legend className="mb-2 p-0">
              <h2 ref={shownStep === 2 ? headingRef : undefined} tabIndex={-1} className="font-display m-0 text-2xl">
                How you found us
              </h2>
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                name="referralCode"
                label="Referral code"
                defaultValue={v.referralCode ?? referralCode ?? ''}
                error={errors.referralCode}
                help={referrerName ? `From ${referrerName}'s invite link.` : 'Optional. Ask the member who invited you.'}
              />
              <SelectField name="guestMeetings" label="Meetings attended as a guest" required defaultValue={v.guestMeetings ?? ''} error={errors.guestMeetings}>
                <option value="" disabled>
                  Choose
                </option>
                <option value="2">2</option>
                <option value="1">1</option>
                <option value="0">None yet</option>
              </SelectField>
            </div>
            <fieldset className="border-line m-0 rounded-xl border p-4">
              <legend className="label px-1.5">I agree to</legend>
              {commitments.map((c) => (
                <Checkbox key={c.name} name={c.name} label={c.label} error={errors[c.name]} />
              ))}
            </fieldset>
          </fieldset>

          <div className="border-line flex flex-wrap justify-between gap-3 border-t pt-5">
            <button type="button" className="btn btn-outline" onClick={() => go(Math.max(0, shownStep - 1))} disabled={shownStep === 0}>
              Back
            </button>
            {shownStep < 2 ? (
              <button type="button" className="btn btn-primary" onClick={() => validateStep(shownStep) && go(shownStep + 1)}>
                Continue
              </button>
            ) : (
              <SubmitButton pendingText="Submitting…">Submit application</SubmitButton>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
