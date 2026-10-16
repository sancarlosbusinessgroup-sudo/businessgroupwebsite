'use client';

import { useActionState } from 'react';
import { SelectField, SubmitButton, TextArea, TextField } from '@/components/forms';
import { useClientValidation } from '@/components/useClientValidation';
import { Notice } from '@/components/ui';
import { idle, leadershipSchema } from '@/lib/validation';
import { addLeader, updateLeader } from '../../actions/admin';

type Member = { id: string; label: string };
type Leader = { id: string; name: string; role: string; bio: string | null; profile_id: string | null; sort_order: number };

function Fields({
  prefix,
  members,
  v,
  d,
  errors,
}: {
  prefix: string;
  members: Member[];
  v: Record<string, string>;
  d?: Leader;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <TextField id={`${prefix}-name`} name="name" label="Name" required defaultValue={v.name ?? d?.name} error={errors.name} />
      <TextField id={`${prefix}-role`} name="role" label="Role" required defaultValue={v.role ?? d?.role} error={errors.role} placeholder="e.g. President" />
      <SelectField
        id={`${prefix}-profile`}
        name="profileId"
        label="Member profile"
        defaultValue={v.profileId ?? d?.profile_id ?? ''}
        error={errors.profileId}
        help="Optional. Links to their profile and uses their photo."
      >
        <option value="">Not linked</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <TextField
        id={`${prefix}-sort`}
        name="sortOrder"
        label="Sort order"
        inputMode="numeric"
        defaultValue={v.sortOrder ?? (d ? String(d.sort_order) : '')}
        error={errors.sortOrder}
        help="Lower numbers show first."
      />
      <div className="md:col-span-2">
        <TextArea id={`${prefix}-bio`} name="bio" label="Short bio" defaultValue={v.bio ?? d?.bio ?? ''} error={errors.bio} maxLength={1000} />
      </div>
    </div>
  );
}

export function AddLeaderForm({ members }: { members: Member[] }) {
  const [state, action] = useActionState(addLeader, idle);
  const { clientErrors, onSubmit } = useClientValidation(leadershipSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="add-h">
      <h2 id="add-h" className="h3">
        Add a person
      </h2>
      {state.status === 'success' ? <Notice tone="success">{state.message}</Notice> : null}
      {state.status === 'error' && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <Fields key={state.status === 'success' ? `ok-${state.message}` : 'add'} prefix="add" members={members} v={v} errors={errors} />
      <div>
        <SubmitButton pendingText="Adding…">Add person</SubmitButton>
      </div>
    </form>
  );
}

export function EditLeaderForm({ leader, members }: { leader: Leader; members: Member[] }) {
  const [state, action] = useActionState(updateLeader, idle);
  const { clientErrors, onSubmit } = useClientValidation(leadershipSchema);
  const errors = clientErrors ?? state.errors ?? {};
  const v = state.status === 'error' ? (state.values ?? {}) : {};
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-label={`Edit ${leader.name}`}>
      <input type="hidden" name="id" value={leader.id} />
      <Fields prefix={`e-${leader.id}`} members={members} v={v} d={leader} errors={errors} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Saving…" className="btn btn-outline btn-sm">
          Save
        </SubmitButton>
        {state.status === 'success' ? (
          <span role="status" className="text-green-ink text-sm font-semibold">
            Saved
          </span>
        ) : null}
        {state.status === 'error' && state.message ? (
          <span role="alert" className="text-red text-sm font-semibold">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
