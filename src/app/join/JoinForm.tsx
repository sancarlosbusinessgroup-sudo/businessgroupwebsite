'use client';

import Link from 'next/link';
import { useActionState, useRef, useState, type FormEvent } from 'react';
import { Checkbox, PasswordField, SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { CheckIcon, Notice } from '@/components/ui';
import { agreementTerms } from '@/lib/content';
import { fieldErrors, formToObject, idle, joinSchema } from '@/lib/validation';
import { signUp } from '../actions/auth';

export type JoinPrefill = { firstName: string; lastName: string; email: string; businessName: string };
type Props = {
  categories: { id: number; name: string; open: boolean }[];
  referralCode?: string;
  referrerName?: string;
  today: string;
  prefill?: JoinPrefill;
};

/** One-page membership application, mirroring the group's paper Member Application Form. */
export function JoinForm({ categories, referralCode, referrerName, today, prefill }: Props) {
  const [state, action] = useActionState(signUp, idle);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const [categoryId, setCategoryId] = useState<string>(state.values?.categoryId ?? '');
  const formRef = useRef<HTMLFormElement>(null);
  const errors = clientErrors ?? state.errors ?? {};
  const v: Record<string, string | undefined> = state.values ?? (prefill ? { ...prefill } : {});
  const [printed, setPrinted] = useState(`${v.firstName ?? ''} ${v.lastName ?? ''}`.trim());
  const fullCategory = categories.find((c) => String(c.id) === categoryId && !c.open);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const r = joinSchema.safeParse(formToObject(new FormData(form)));
    if (r.success) {
      setClientErrors(null);
      return;
    }
    e.preventDefault();
    const errs = fieldErrors(r.error);
    setClientErrors(errs);
    const first = Object.keys(errs)[0];
    (first ? (form.elements.namedItem(first) as HTMLElement | null) : null)?.focus();
  }

  if (state.status === 'success') {
    return (
      <div className="border-line bg-surface min-w-0 flex-[999_1_560px] rounded-[20px] border p-8" role="status">
        <div className="flex flex-col items-start gap-4">
          <span className="bg-green-tint text-green flex h-14 w-14 items-center justify-center rounded-full">
            <CheckIcon />
          </span>
          <h2 className="font-display m-0 text-[26px]" tabIndex={-1}>
            Application received
          </h2>
          {state.message === 'confirm-email' ? <Notice tone="info">We sent a confirmation link to {v.email}. Click it to confirm your email.</Notice> : null}
          <p className="text-ink-soft m-0">
            Your account is a <strong>Guest applicant</strong> until the Membership Committee approves it. Here&apos;s what happens next:
          </p>
          <ol className="m-0 flex w-full list-none flex-col gap-2.5 p-0">
            <li className="border-line rounded-xl border px-4 py-3.5">Attend up to 2 meetings as a guest</li>
            <li className="border-line rounded-xl border px-4 py-3.5">One-to-ones with three Membership Committee members</li>
            <li className="border-line flex justify-between gap-3 rounded-xl border px-4 py-3.5">
              <span>Reference checks and Membership Committee review</span>
              <strong className="text-ink-muted">Pending</strong>
            </li>
          </ol>
          {/* No log-in button: only approved members can log in (owner, 2026-10-24). */}
          <p className="text-ink-soft m-0">
            You can log in once the Membership Committee approves your membership. We&apos;ll email you when you&apos;re approved.
          </p>
        </div>
      </div>
    );
  }

  const section = 'border-line m-0 flex flex-col gap-4 rounded-2xl border p-5 sm:p-6';
  const legend = 'font-display text-heading px-1.5 text-xl font-bold';

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      onChange={(e) => {
        const f = e.currentTarget.elements;
        const get = (n: string) => ((f.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim();
        setPrinted(`${get('firstName')} ${get('lastName')}`.trim());
      }}
      noValidate
      className="border-line bg-surface flex min-w-0 flex-[999_1_560px] flex-col gap-6 rounded-[20px] border p-5 sm:p-8"
      aria-labelledby="apply-h"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="apply-h" className="font-display m-0 text-2xl">
          Member application form
        </h2>
        <span className="text-ink-muted text-sm">Application date: {today}</span>
      </div>
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      {clientErrors ? <Notice tone="error">Please fix the highlighted fields.</Notice> : null}

      <fieldset className={section}>
        <legend className={legend}>Business information</legend>
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
          <TextField name="phone" type="tel" label="Business phone" autoComplete="tel" required defaultValue={v.phone} error={errors.phone} />
          <TextField name="businessName" label="Business name" autoComplete="organization" required defaultValue={v.businessName} error={errors.businessName} />
          <SelectField
            name="categoryId"
            label="Category"
            required
            defaultValue={v.categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value)}
            error={errors.categoryId}
            help={
              fullCategory
                ? `${fullCategory.name} already has a member, and we keep one member per profession. You can still apply; the Membership Committee will contact you about fit.`
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
          <TextField
            name="businessAddress"
            label="Business address"
            autoComplete="street-address"
            defaultValue={v.businessAddress}
            error={errors.businessAddress}
          />
          <div className="sm:col-span-2">
            <TextField
              name="yearsInBusiness"
              label="How long have you been in this business?"
              required
              defaultValue={v.yearsInBusiness}
              error={errors.yearsInBusiness}
              maxLength={60}
            />
          </div>
          <div className="sm:col-span-2">
            <TextArea
              name="productService"
              label="Describe your product or service"
              required
              defaultValue={v.productService}
              error={errors.productService}
              maxLength={1000}
              help="Shown on your profile once you're approved."
            />
          </div>
          <TextArea
            name="credentials"
            label="Education, degrees, licenses or credentials required for your position"
            defaultValue={v.credentials}
            error={errors.credentials}
            maxLength={1000}
          />
          <TextArea
            name="networkingGroups"
            label="Name all the networking groups you currently belong to"
            defaultValue={v.networkingGroups}
            error={errors.networkingGroups}
            maxLength={500}
          />
          <div className="sm:col-span-2">
            <PasswordField
              name="password"
              label="Password"
              autoComplete="new-password"
              required
              error={errors.password}
              help="For your member account. At least 8 characters."
            />
          </div>
        </div>
      </fieldset>

      {([1, 2] as const).map((n) => (
        <fieldset key={n} className={section}>
          <legend className={legend}>Business reference {n}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField id={`ref${n}Name`} name={`ref${n}Name`} label="Name" required defaultValue={v[`ref${n}Name`]} error={errors[`ref${n}Name`]} />
            <TextField
              id={`ref${n}Business`}
              name={`ref${n}Business`}
              label="Business"
              placeholder="e.g. Accountant"
              defaultValue={v[`ref${n}Business`]}
              error={errors[`ref${n}Business`]}
            />
            <div className="sm:col-span-2">
              <TextField
                id={`ref${n}BusinessName`}
                name={`ref${n}BusinessName`}
                label="Business name"
                defaultValue={v[`ref${n}BusinessName`]}
                error={errors[`ref${n}BusinessName`]}
              />
            </div>
            <TextField
              id={`ref${n}Email`}
              name={`ref${n}Email`}
              type="email"
              label="Email"
              defaultValue={v[`ref${n}Email`]}
              error={errors[`ref${n}Email`]}
              help="An email or phone is required."
            />
            <TextField id={`ref${n}Phone`} name={`ref${n}Phone`} type="tel" label="Phone" defaultValue={v[`ref${n}Phone`]} error={errors[`ref${n}Phone`]} />
            <div className="sm:col-span-2">
              <TextField
                id={`ref${n}Website`}
                name={`ref${n}Website`}
                type="url"
                label="Website"
                placeholder="https://"
                defaultValue={v[`ref${n}Website`]}
                error={errors[`ref${n}Website`]}
              />
            </div>
          </div>
        </fieldset>
      ))}

      <fieldset className={section}>
        <legend className={legend}>How you found us</legend>
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
      </fieldset>

      <fieldset className={section}>
        <legend className={legend}>Agreement terms</legend>
        <dl className="m-0 flex flex-col gap-3">
          {agreementTerms.map((t) => (
            <div key={t.title}>
              <dt className="font-bold">{t.title}</dt>
              <dd className="text-ink-soft m-0">{t.text}</dd>
            </div>
          ))}
        </dl>
        <p className="m-0 text-[15px]">
          Please read our{' '}
          <Link href="/bylaws" target="_blank">
            Bylaws and Procedures
          </Link>{' '}
          before you sign.
        </p>
        <Checkbox
          name="agree"
          label="By signing below, I agree to the terms above, acknowledge that I have read and understood the Bylaws and group Procedures, and that all information is correct to the best of my ability."
          defaultChecked={v.agree === 'on'}
          error={errors.agree}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            name="signature"
            label="Signature"
            required
            autoComplete="name"
            defaultValue={v.signature}
            error={errors.signature}
            help="Type your full name."
            className="field font-display italic"
          />
          <div>
            <span className="label">Date</span>
            <p className="field bg-canvas m-0 flex items-center">{today}</p>
          </div>
          <div>
            <span className="label">Name</span>
            <p className="field bg-canvas m-0 flex items-center" aria-live="polite">
              {printed || <span className="text-ink-muted">Filled in from your name above</span>}
            </p>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-ink-muted text-sm">Your answers are seen only by the Membership Committee.</span>
        <SubmitButton pendingText="Submitting…">Submit application</SubmitButton>
      </div>
    </form>
  );
}
