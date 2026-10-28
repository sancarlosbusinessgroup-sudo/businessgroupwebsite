'use client';

import { useActionState } from 'react';
import { Checkbox, SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { referralStatusLabels } from '@/lib/content';
import { adminOneOnOneSchema, adminProfileSchema, adminReferralSchema, idle, memberStatuses, referralStatuses } from '@/lib/validation';
import type { ProfileDefaults } from '../../../profile/ProfileForm';
import { adminUpdateOneOnOne, adminUpdateProfile, adminUpdateReferral, setAdminRole } from '../../../actions/admin-edit';

const statusLabels: Record<(typeof memberStatuses)[number], string> = {
  pending: 'Pending (applied, not yet approved)',
  approved: 'Approved (active member)',
  inactive: 'Inactive (can’t log in)',
  declined: 'Declined (can’t log in)',
};

/** The same fields the member edits on My profile, plus status; saved on their behalf. */
export function AdminProfileForm({
  id,
  defaults,
  status,
  categories,
}: {
  id: string;
  defaults: ProfileDefaults;
  status: (typeof memberStatuses)[number];
  categories: { id: number; name: string }[];
}) {
  const [state, action] = useActionState(adminUpdateProfile, idle);
  const { clientErrors, onSubmit } = useClientValidation(adminProfileSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status !== 'idle' && state.values ? state.values : null;
  const val = (k: keyof ProfileDefaults) => (v ? (v[k] ?? '') : String(defaults[k] ?? ''));
  const checked = (k: 'showInDirectory' | 'showPhonePublic') => (v ? v[k] === 'on' : defaults[k]);

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="card flex flex-col gap-[22px] p-7" aria-labelledby="profile-h">
      <h2 id="profile-h" className="h3">
        Profile
      </h2>
      <input type="hidden" name="id" value={id} />
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField name="firstName" label="First name" required defaultValue={val('firstName')} error={errors.firstName} />
        <TextField name="lastName" label="Last name" required defaultValue={val('lastName')} error={errors.lastName} />
        <TextField name="businessName" label="Business name" required defaultValue={val('businessName')} error={errors.businessName} />
        <SelectField name="categoryId" label="Category" defaultValue={val('categoryId')} error={errors.categoryId}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField name="status" label="Status" defaultValue={v ? v.status : status} error={errors.status} help="Approving sends the welcome email.">
          {memberStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </SelectField>
        <TextField
          name="phone"
          type="tel"
          label="Phone"
          defaultValue={val('phone')}
          error={errors.phone}
          help="The sign-in email is changed by the member, from My profile."
        />
        <TextField name="website" type="url" label="Website" placeholder="https://" defaultValue={val('website')} error={errors.website} />
        <TextField name="city" label="City" defaultValue={val('city')} error={errors.city} />
        <TextField name="serviceArea" label="Service area" defaultValue={val('serviceArea')} error={errors.serviceArea} />
        <div className="md:col-span-2">
          <TextArea name="about" label="About" defaultValue={val('about')} error={errors.about} maxLength={2000} />
        </div>
        <TextArea name="idealClient" label="Ideal client" defaultValue={val('idealClient')} error={errors.idealClient} maxLength={1000} />
        <TextArea name="listenFor" label="Listen for" defaultValue={val('listenFor')} error={errors.listenFor} maxLength={500} />
        <div className="md:col-span-2">
          <TextField name="services" label="Services" defaultValue={val('services')} error={errors.services} help="Separate with commas, up to 12." />
        </div>
      </div>
      <fieldset className="border-line m-0 flex flex-col gap-1 rounded-xl border p-4">
        <legend className="label px-1.5">Visibility</legend>
        <Checkbox name="showInDirectory" label="Listed in the public directory" defaultChecked={checked('showInDirectory')} />
        <Checkbox name="showPhonePublic" label="Phone shown to visitors (not just members)" defaultChecked={checked('showPhonePublic')} />
      </fieldset>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}

/** Owners only: make or remove an admin. */
export function RoleForm({ id, role, isSelf, isOwner }: { id: string; role: 'member' | 'admin'; isSelf: boolean; isOwner: boolean }) {
  const [state, action] = useActionState(setAdminRole, idle);
  const next = role === 'admin' ? 'member' : 'admin';
  return (
    <form action={action} className="flex flex-col gap-2" aria-label="Admin role">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="role" value={next} />
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <p className="m-0 text-[15px]">
        {role === 'admin' ? 'This member is an admin.' : 'This member is not an admin.'}
        {isOwner ? ' Owners stay admins.' : null}
      </p>
      {isSelf ? (
        <p className="text-ink-muted m-0 text-sm">You can’t change your own role.</p>
      ) : isOwner ? null : (
        <div>
          <SubmitButton pendingText="Saving…" className={`btn btn-sm ${next === 'admin' ? 'btn-primary' : 'btn-outline text-red'}`}>
            {next === 'admin' ? 'Make admin' : 'Remove admin role'}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}

export type ReferralRow = {
  id: string;
  contact_name: string;
  status: string;
  amount: number | null;
  notes: string | null;
  created_at: string;
  referred_on: string;
  closed_on: string | null;
  other: string;
  direction: 'sent' | 'received';
};

export function ReferralEditForm({ r }: { r: ReferralRow }) {
  const [state, action] = useActionState(adminUpdateReferral, idle);
  const { clientErrors, onSubmit } = useClientValidation(adminReferralSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.values ?? {};
  const prefix = `ref-${r.id}`;
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-label={`Referral: ${r.contact_name}`}>
      <input type="hidden" name="id" value={r.id} />
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField
          id={`${prefix}-name`}
          name="contactName"
          label="Prospect"
          required
          defaultValue={v.contactName ?? r.contact_name}
          error={errors.contactName}
        />
        <SelectField id={`${prefix}-status`} name="status" label="Status" defaultValue={v.status ?? r.status} error={errors.status}>
          {referralStatuses.map((s) => (
            <option key={s} value={s}>
              {referralStatusLabels[s]}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${prefix}-amount`}
          name="amount"
          label="Amount"
          inputMode="decimal"
          defaultValue={v.amount ?? (r.amount != null ? String(r.amount) : '')}
          error={errors.amount}
        />
        <div className="md:col-span-3">
          <TextArea id={`${prefix}-notes`} name="notes" label="Notes" defaultValue={v.notes ?? r.notes ?? ''} error={errors.notes} maxLength={1000} rows={2} />
        </div>
        <TextField
          id={`${prefix}-ref-on`}
          name="referredOn"
          type="date"
          label="Date referred"
          defaultValue={v.referredOn ?? r.referred_on}
          error={errors.referredOn}
        />
        <TextField
          id={`${prefix}-closed-on`}
          name="closedOn"
          type="date"
          label="Closed on"
          defaultValue={v.closedOn ?? r.closed_on ?? ''}
          error={errors.closedOn}
          help="Counts only for closed business."
        />
      </div>
      <div>
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Save referral
        </SubmitButton>
      </div>
    </form>
  );
}

export type OneOnOneRow = { id: string; met_on: string; confirmed_at: string | null; other: string; reported: boolean };

export function OneOnOneEditForm({ o }: { o: OneOnOneRow }) {
  const [state, action] = useActionState(adminUpdateOneOnOne, idle);
  const { clientErrors, onSubmit } = useClientValidation(adminOneOnOneSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.values ?? {};
  const prefix = `oo-${o.id}`;
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-3" aria-label={`One-on-one with ${o.other}`}>
      <input type="hidden" name="id" value={o.id} />
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <TextField id={`${prefix}-date`} name="metOn" type="date" label="Date" required defaultValue={v.metOn ?? o.met_on} error={errors.metOn} />
      <div className="pb-2">
        <Checkbox name="confirmed" label="Confirmed (counts)" defaultChecked={v.confirmed ? v.confirmed === 'on' : !!o.confirmed_at} />
      </div>
      <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
        Save
      </SubmitButton>
    </form>
  );
}
