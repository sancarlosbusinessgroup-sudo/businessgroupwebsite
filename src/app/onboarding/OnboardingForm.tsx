'use client';

import { useActionState } from 'react';
import { completeOnboarding } from '@/app/actions/member';
import { Checkbox, SubmitButton } from '@/components/forms';
import { Notice } from '@/components/ui';
import { idle } from '@/lib/validation';

export function OnboardingForm({ done }: { done: boolean }) {
  const [state, action] = useActionState(completeOnboarding, idle);
  const errors = state.errors ?? {};
  return (
    <form action={action} noValidate className="card flex flex-col gap-3 p-6" aria-labelledby="ob-agree-h">
      <h2 id="ob-agree-h" className="h3">
        3. Two quick agreements
      </h2>
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <Checkbox
        name="shareContacts"
        defaultChecked={done}
        error={errors.shareContacts}
        label="I agree that other members can see my email and phone number so they can pass me referrals and set up one-on-ones."
      />
      <Checkbox
        name="agreed"
        defaultChecked={done}
        error={errors.agreed}
        label="I agree to the member commitments: attend every meeting (no more than 2 absences in 6 months), give referrals and follow the Bylaws."
      />
      <div>
        <SubmitButton pendingText="Saving…">{done ? 'Save again' : 'Finish onboarding'}</SubmitButton>
      </div>
    </form>
  );
}
