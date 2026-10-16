import { z } from 'zod';
import { isoDateDaysAgo, localDateKey } from './dates';

// Shared by client components (instant inline errors) and server actions (authoritative checks).

const text = (max: number, label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

const uuid = (msg: string) => z.string({ error: msg }).uuid(msg);
const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
const mustCheck = (msg: string) => z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.literal(true, { error: msg }));

const phone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^[0-9()+\-.\s]{7,25}$/.test(v), 'Enter a valid phone number');

const website = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), 'Website must start with http:// or https://');

const password = z.string({ error: 'Password is required' }).min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer');

export const referralCode = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^[A-Z]{4}-[A-Z0-9]{3}$/.test(v), 'That referral code looks wrong');

export const guestRequestSchema = z.object({
  firstName: text(60, 'First name'),
  lastName: text(60, 'Last name'),
  email,
  businessName: optionalText(120, 'Business name'),
  invitedBy: optionalText(120, 'Who invited you'),
  referralCode,
  meetingId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || z.uuid().safeParse(v).success, 'Choose a meeting'),
  // Honeypot: humans never see or fill this field.
  company: z.string().max(0, 'Leave this field empty').optional(),
});

export const joinAccountSchema = z.object({
  firstName: text(60, 'First name'),
  lastName: text(60, 'Last name'),
  email,
  phone,
  password,
});

export const joinBusinessSchema = z.object({
  businessName: text(120, 'Business name'),
  categoryId: z.coerce.number({ error: 'Choose a category' }).int('Choose a category').positive('Choose a category'),
  website,
  serviceArea: optionalText(120, 'Service area'),
  idealClient: optionalText(1000, 'Ideal client'),
});

export const joinReferralSchema = z.object({
  referralCode,
  guestMeetings: z.enum(['0', '1', '2'], { error: 'Choose how many meetings you attended' }),
  attend: mustCheck('Please agree to attend meetings regularly'),
  oneOnOnes: mustCheck('Please agree to the committee one-on-ones'),
  report: mustCheck('Please agree to report your activity'),
});

export const joinSchema = joinAccountSchema.and(joinBusinessSchema).and(joinReferralSchema);

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });
export const emailOnlySchema = z.object({ email });
export const otpSchema = z.object({
  email,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const referralStatuses = ['new', 'contacted', 'meeting_set', 'closed_deal', 'not_a_fit'] as const;

export const referralSchema = z.object({
  toId: uuid('Choose a member to refer to'),
  contactName: z.string().trim().min(2, 'Enter the prospect’s name').max(120, 'Prospect name must be 120 characters or fewer'),
  prospectPhone: phone,
  prospectEmail: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || (v.length <= 254 && z.email().safeParse(v).success), 'Enter a valid email address'),
  notes: optionalText(1000, 'Notes'),
  consent: checkbox,
});

export const referralUpdateSchema = z.object({
  id: uuid('Missing referral'),
  status: z.enum(referralStatuses, { error: 'Choose a status' }),
});

export const oneOnOneSchema = (now: Date = new Date()) =>
  z.object({
    partnerId: uuid('Choose who you met with'),
    metOn: z
      .string({ error: 'Choose the date' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date')
      .refine((d) => d <= localDateKey(now) && d >= isoDateDaysAgo(14, now), 'Report activity from today or the previous 14 days'),
    note: optionalText(1000, 'Note'),
  });

export const profileSchema = z.object({
  firstName: text(60, 'First name'),
  lastName: text(60, 'Last name'),
  businessName: text(120, 'Business name'),
  categoryId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'Choose a category'),
  website,
  phone,
  city: optionalText(80, 'City'),
  serviceArea: optionalText(120, 'Service area'),
  about: optionalText(2000, 'About'),
  idealClient: optionalText(1000, 'Ideal client'),
  listenFor: optionalText(500, 'Listen for'),
  services: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .refine((a) => a.length <= 12, 'List up to 12 services')
    .refine((a) => a.every((s) => s.length <= 40), 'Keep each service under 40 characters'),
  showInDirectory: checkbox,
  showPhonePublic: checkbox,
});

export const correctionSchema = z.object({
  meetingId: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || z.uuid().safeParse(v).success, 'Choose a meeting'),
  note: z.string().trim().min(5, 'Tell us what needs fixing').max(1000, 'Keep it under 1000 characters'),
});

export const galleryMetaSchema = z.object({
  album: z.enum(['meetings', 'mixers', 'spotlights', 'community'], { error: 'Choose an album' }),
  caption: z.string().trim().min(2, 'Add a short caption').max(140, 'Keep the caption under 140 characters'),
  takenOn: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date'),
});

export const weeklyAskSchema = z.object({
  weeklyAsk: z
    .string()
    .trim()
    .max(160, 'Keep your ask to 160 characters or fewer')
    .optional()
    .transform((v) => (v ? v : null)),
});

export const leadershipSchema = z.object({
  name: text(120, 'Name').refine((v) => v.length >= 2, 'Name is required'),
  role: text(80, 'Role').refine((v) => v.length >= 2, 'Role is required'),
  bio: optionalText(1000, 'Bio'),
  profileId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.uuid().safeParse(v).success, 'Choose a member'),
  sortOrder: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0))
    .refine((v) => Number.isInteger(v) && v >= 0 && v <= 999, 'Use a whole number from 0 to 999'),
});

export const seatLimitSchema = z.object({
  id: z.coerce.number().int().positive(),
  seatLimit: z.coerce.number({ error: 'Enter a number' }).int('Use a whole number').min(1, 'At least 1 seat').max(99, 'At most 99 seats'),
});

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** Shape every server action returns, consumed by useActionState in forms. */
export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

export const idle: ActionState = { status: 'idle' };
