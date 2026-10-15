'use client';

import { useActionState } from 'react';
import { Checkbox, SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, profileSchema } from '@/lib/validation';
import { updateProfile } from '../actions/member';

export type ProfileDefaults = {
  firstName: string;
  lastName: string;
  businessName: string;
  categoryId: string;
  website: string;
  phone: string;
  city: string;
  serviceArea: string;
  about: string;
  idealClient: string;
  listenFor: string;
  services: string;
  showInDirectory: boolean;
  showStats: boolean;
  showPhonePublic: boolean;
};

export function ProfileForm({ defaults, categories }: { defaults: ProfileDefaults; categories: { id: number; name: string }[] }) {
  const [state, action] = useActionState(updateProfile, idle);
  const { clientErrors, onSubmit } = useClientValidation(profileSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' && state.values ? state.values : null;
  const val = (k: keyof ProfileDefaults) => (v ? (v[k] ?? '') : String(defaults[k] ?? ''));
  const checked = (k: 'showInDirectory' | 'showStats' | 'showPhonePublic') => (v ? v[k] === 'on' : defaults[k]);

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="card flex flex-col gap-[22px] p-7" aria-label="Edit profile">
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField name="firstName" label="First name" autoComplete="given-name" required defaultValue={val('firstName')} error={errors.firstName} />
        <TextField name="lastName" label="Last name" autoComplete="family-name" required defaultValue={val('lastName')} error={errors.lastName} />
        <TextField name="businessName" label="Business name" required defaultValue={val('businessName')} error={errors.businessName} />
        <SelectField name="categoryId" label="Category" defaultValue={val('categoryId')} error={errors.categoryId}>
          <option value="">Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField name="website" type="url" label="Website" placeholder="https://" defaultValue={val('website')} error={errors.website} />
        <TextField name="phone" type="tel" label="Phone" autoComplete="tel" defaultValue={val('phone')} error={errors.phone} />
        <TextField name="city" label="City" defaultValue={val('city')} error={errors.city} />
        <TextField name="serviceArea" label="Service area" defaultValue={val('serviceArea')} error={errors.serviceArea} />
        <div className="md:col-span-2">
          <TextArea name="about" label="About" defaultValue={val('about')} error={errors.about} maxLength={2000} />
        </div>
        <TextArea name="idealClient" label="Ideal client" defaultValue={val('idealClient')} error={errors.idealClient} maxLength={1000} />
        <TextArea
          name="listenFor"
          label="Listen for"
          defaultValue={val('listenFor')}
          error={errors.listenFor}
          help="Phrases that signal a lead for you."
          maxLength={500}
        />
        <div className="md:col-span-2">
          <TextField name="services" label="Services" defaultValue={val('services')} error={errors.services} help="Separate with commas, up to 12." />
        </div>
      </div>
      <fieldset className="border-line m-0 flex flex-col gap-1 rounded-xl border p-4">
        <legend className="label px-1.5">Visibility</legend>
        <Checkbox name="showInDirectory" label="Show my listing in the public directory" defaultChecked={checked('showInDirectory')} />
        <Checkbox name="showStats" label="Show my activity stats on my profile" defaultChecked={checked('showStats')} />
        <Checkbox name="showPhonePublic" label="Show my phone number to visitors (not just members)" defaultChecked={checked('showPhonePublic')} />
      </fieldset>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}
