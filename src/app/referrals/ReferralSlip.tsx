import { personName } from '@/lib/people';
import { Pill } from '@/components/ui';
import { referralStatusLabels } from '@/lib/content';
import { formatMoney, formatShortDate, localDateKey } from '@/lib/dates';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { deleteReferral } from '../actions/member';
import { UpdateReferralForm } from './ReferralForms';

/** Columns every referral list selects (Referrals page and Closed Businesses page). */
export const referralSelect =
  'id, from_id, to_id, contact_name, prospect_phone, prospect_email, amount, notes, status, created_at, closed_at, from:profiles!referrals_from_id_fkey(first_name, last_name), to:profiles!referrals_to_id_fkey(first_name, last_name)';

type Person = { first_name: string; last_name: string } | null;
export type ReferralRow = {
  id: string;
  from_id: string | null;
  to_id: string | null;
  contact_name: string;
  prospect_phone: string | null;
  prospect_email: string | null;
  amount: number | null;
  notes: string | null;
  status: keyof typeof referralStatusLabels;
  created_at: string;
  closed_at: string | null;
  from: Person;
  to: Person;
};

const refTone = { new: 'gray', contacted: 'teal', meeting_set: 'teal', closed_deal: 'green', not_a_fit: 'amber' } as const;

/** One referral slip: labelled details for both parties; the receiver can update status and value. */
export function ReferralSlip({ r, isReceived, isAdmin }: { r: ReferralRow; isReceived: boolean; isAdmin: boolean }) {
  const other = isReceived ? r.from : r.to;
  return (
    <li className="border-line flex flex-col gap-2 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="text-ink-muted text-sm">{isReceived ? '← From' : 'To →'}</span> <strong>{personName(other)}</strong>
        </span>
        <span className="text-ink-muted flex flex-wrap items-center gap-2 text-sm">
          {formatShortDate(new Date(r.created_at))}
          {r.status === 'closed_deal' && r.closed_at ? <span>· closed {formatShortDate(new Date(r.closed_at))}</span> : null}
          <Pill tone={refTone[r.status]}>{referralStatusLabels[r.status]}</Pill>
        </span>
      </div>
      {/* Labelled details, the same for the giver and the receiver (owner, 2026-10-24). */}
      <dl className="text-ink-soft m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
        <dt className="text-ink-muted">Name of Referral:</dt>
        <dd className="m-0 font-semibold">{r.contact_name}</dd>
        {r.prospect_phone ? (
          <>
            <dt className="text-ink-muted">Phone:</dt>
            <dd className="m-0">
              <a href={`tel:${r.prospect_phone.replace(/[^0-9+]/g, '')}`}>{r.prospect_phone}</a>
            </dd>
          </>
        ) : null}
        {r.prospect_email ? (
          <>
            <dt className="text-ink-muted">Email:</dt>
            <dd className="m-0 break-all">
              <a href={`mailto:${r.prospect_email}`}>{r.prospect_email}</a>
            </dd>
          </>
        ) : null}
        {r.notes ? (
          <>
            <dt className="text-ink-muted">Note:</dt>
            <dd className="m-0 whitespace-pre-line">{r.notes}</dd>
          </>
        ) : null}
      </dl>
      {r.amount !== null ? (
        <span className="text-ink-soft text-[15px]">
          Value: <strong>{formatMoney(r.amount)}</strong>
        </span>
      ) : null}
      {isReceived ? (
        <UpdateReferralForm
          id={r.id}
          status={r.status}
          amount={r.amount}
          closedOn={r.closed_at ? localDateKey(new Date(r.closed_at)) : null}
          today={localDateKey(new Date())}
          label={r.contact_name}
        />
      ) : null}
      {!isReceived || isAdmin ? <ConfirmDelete action={deleteReferral} id={r.id} what={`referral slip for ${r.contact_name}`} className="self-start" /> : null}
    </li>
  );
}
