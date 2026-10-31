import { SelectField, TextField } from './forms';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Second business name and birthday (owner meeting 2026-10-30), shared by My profile and Admin → Members.
 * Birthday is month and day only; it is shown to members only, never to visitors.
 */
export function ProfileExtraFields({
  val,
  errors,
}: {
  val: (k: 'secondBusinessName' | 'birthdayMonth' | 'birthdayDay') => string;
  errors: Record<string, string | undefined>;
}) {
  return (
    <>
      <TextField
        name="secondBusinessName"
        label="Second business name (optional)"
        defaultValue={val('secondBusinessName')}
        error={errors.secondBusinessName}
        help="If you also run another business, it shows next to your business name."
        maxLength={120}
      />
      <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
        <legend className="label">Birthday (optional)</legend>
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          {/* key: a select keeps its first default after the form resets, so remount it when the value to show changes. */}
          <SelectField key={`bm-${val('birthdayMonth')}`} name="birthdayMonth" label="Month" defaultValue={val('birthdayMonth')} error={errors.birthdayMonth}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </SelectField>
          <TextField name="birthdayDay" label="Day" inputMode="numeric" maxLength={2} defaultValue={val('birthdayDay')} error={errors.birthdayDay} />
        </div>
        <p className="help m-0">No year. Members see it, and we wish you a happy birthday at the meeting.</p>
      </fieldset>
    </>
  );
}
