import { z } from 'zod';
import { isoDateDaysAgo, localDateKey, pacificLocalToIso } from './dates';
import { SLIDE_KEYS, type SlideKey } from './slides';

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

/** Optional dollar amount typed like "1250", "$1,250" or "1250.50". */
export const money = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[$,\s]/g, '') : undefined))
  .refine((v) => v === undefined || /^\d{1,9}(\.\d{1,2})?$/.test(v), 'Enter a dollar amount, like 1250 or 1,250.50')
  .transform((v) => (v === undefined ? undefined : Number(v)));

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
  phone: z
    .string({ error: 'Phone is required' })
    .trim()
    .min(1, 'Phone is required')
    .refine((v) => /^[0-9()+\-.\s]{7,25}$/.test(v), 'Enter a valid phone number'),
  website,
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

const refEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || (v.length <= 254 && z.email().safeParse(v).success), 'Enter a valid email address');

/** One-page membership application (mirrors the group's paper Member Application Form). */
export const joinSchema = z
  .object({
    firstName: text(60, 'First name'),
    lastName: text(60, 'Last name'),
    email,
    phone: z
      .string({ error: 'Business phone is required' })
      .trim()
      .min(1, 'Business phone is required')
      .refine((v) => /^[0-9()+\-.\s]{7,25}$|^[0-9()+\-.\s]{7,20}\s*(ext\.?|x)\s*\d{1,6}$/i.test(v), 'Enter a valid phone number'),
    password,
    businessName: text(120, 'Business name'),
    categoryId: z.coerce.number({ error: 'Choose a category' }).int('Choose a category').positive('Choose a category'),
    website,
    businessAddress: optionalText(200, 'Business address'),
    yearsInBusiness: text(60, 'How long you have been in business').refine(Boolean, 'Tell us how long you have been in business'),
    productService: z
      .string({ error: 'Please describe your product or service' })
      .trim()
      .min(1, 'Please describe your product or service')
      .max(1000, 'Keep this under 1000 characters'),
    credentials: optionalText(1000, 'Education and credentials'),
    networkingGroups: optionalText(500, 'Networking groups'),
    ref1Name: text(120, 'Reference name'),
    ref1Business: optionalText(120, 'Reference business'),
    ref1BusinessName: optionalText(120, 'Reference business name'),
    ref1Email: refEmail,
    ref1Phone: phone,
    ref1Website: website,
    ref2Name: text(120, 'Reference name'),
    ref2Business: optionalText(120, 'Reference business'),
    ref2BusinessName: optionalText(120, 'Reference business name'),
    ref2Email: refEmail,
    ref2Phone: phone,
    ref2Website: website,
    referralCode,
    guestMeetings: z.enum(['0', '1', '2'], { error: 'Choose how many meetings you attended' }),
    agree: mustCheck('Please agree to the terms to sign'),
    signature: z
      .string({ error: 'Type your full name as your signature' })
      .trim()
      .min(2, 'Type your full name as your signature')
      .max(120, 'Keep your signature under 120 characters'),
  })
  .superRefine((v, ctx) => {
    for (const n of [1, 2] as const) {
      if (!v[`ref${n}Email`] && !v[`ref${n}Phone`])
        ctx.addIssue({ code: 'custom', path: [`ref${n}Email`], message: 'Add an email or phone for this reference' });
    }
  })
  .transform((v) => ({
    ...v,
    application: {
      business_phone: v.phone,
      business_address: v.businessAddress ?? null,
      years_in_business: v.yearsInBusiness,
      product_service: v.productService,
      credentials: v.credentials ?? null,
      networking_groups: v.networkingGroups ?? null,
      references: ([1, 2] as const).map((n) => ({
        name: v[`ref${n}Name`],
        business: v[`ref${n}Business`] ?? null,
        business_name: v[`ref${n}BusinessName`] ?? null,
        email: v[`ref${n}Email`] ?? null,
        phone: v[`ref${n}Phone`] ?? null,
        website: v[`ref${n}Website`] ?? null,
      })),
      signature_name: v.signature,
    },
  }));

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });
export const emailOnlySchema = z.object({ email });
export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

/** Change password from My profile: the current password, then the new one twice. */
export const changePasswordSchema = z
  .object({ current: z.string({ error: 'Enter your current password' }).min(1, 'Enter your current password').max(72), password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
  .refine((v) => v.password !== v.current, { path: ['password'], message: 'Choose a password different from your current one' });

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
  amount: money,
  notes: optionalText(1000, 'Notes'),
});

export const referralUpdateSchema = z.object({
  id: uuid('Missing referral'),
  status: z.enum(referralStatuses, { error: 'Choose a status' }),
  amount: money,
});

/** Asking another member for a one-on-one that hasn't happened yet. */
export const oneOnOneRequestSchema = (now: Date = new Date()) =>
  z.object({
    inviteeId: uuid('Choose who you would like to meet'),
    proposedOn: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((d) => d === undefined || (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= localDateKey(now)), 'Choose today or a later date'),
    message: optionalText(500, 'Message'),
  });

export const oneOnOneRequestStatuses = ['accepted', 'declined', 'cancelled'] as const;

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

export const eventCategories = ['Networking', 'Social', 'Workshop', 'Community'] as const;

/** Member event form. Times are typed as Pacific wall-clock and converted to UTC here. */
export const memberEventSchema = (now: Date = new Date()) =>
  z
    .object({
      title: z
        .string({ error: 'Event title is required' })
        .trim()
        .min(1, 'Event title is required')
        .min(3, 'Use at least 3 characters')
        .max(160, 'Keep the title under 160 characters'),
      description: optionalText(4000, 'Description'),
      category: z.enum(eventCategories, { error: 'Choose a category' }),
      startsAt: z.string({ error: 'Choose when it starts' }).transform((v, ctx) => {
        const iso = pacificLocalToIso(v);
        if (!iso) {
          ctx.addIssue({ code: 'custom', message: 'Choose when it starts' });
          return z.NEVER;
        }
        return iso;
      }),
      endsAt: z.string({ error: 'Choose when it ends' }).transform((v, ctx) => {
        const iso = pacificLocalToIso(v);
        if (!iso) {
          ctx.addIssue({ code: 'custom', message: 'Choose when it ends' });
          return z.NEVER;
        }
        return iso;
      }),
      format: z.enum(['online', 'in_person'], { error: 'Choose online or in person' }),
      onlineUrl: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : null)),
      location: z
        .string()
        .trim()
        .max(200, 'Keep the address under 200 characters')
        .optional()
        .transform((v) => (v ? v : null)),
    })
    .superRefine((v, ctx) => {
      if (v.startsAt < new Date(now.getTime() - 60 * 60000).toISOString())
        ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'Choose a date and time in the future' });
      if (v.endsAt <= v.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end must be after the start' });
      if (v.format === 'online' && !(v.onlineUrl && /^https:\/\/[^\s]+\.[^\s]+$/i.test(v.onlineUrl) && v.onlineUrl.length <= 500))
        ctx.addIssue({ code: 'custom', path: ['onlineUrl'], message: 'Use a secure link that starts with https://' });
      if (v.format === 'in_person' && !v.location) ctx.addIssue({ code: 'custom', path: ['location'], message: 'Add the address' });
    })
    .transform((v) => ({
      title: v.title,
      description: v.description ?? null,
      category: v.category,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      isOnline: v.format === 'online',
      onlineUrl: v.format === 'online' ? v.onlineUrl : null,
      location: v.format === 'in_person' ? v.location : null,
    }));

export const speakerTopicSchema = z.object({
  topic: z.string({ error: 'Add a topic' }).trim().min(1, 'Add a topic').min(3, 'Use at least 3 characters').max(120, 'Keep the topic under 120 characters'),
  topicDescription: z
    .string()
    .trim()
    .max(500, 'Keep the description under 500 characters')
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Slide settings form: show_<key>=on and order_<key>=<number> → shown keys in order. */
export const slideSettingsSchema = z.record(z.string(), z.string()).transform((form, ctx) => {
  const shown = SLIDE_KEYS.filter((k) => form[`show_${k}`] === 'on' || form[`show_${k}`] === 'true');
  if (shown.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'Show at least one slide' });
    return z.NEVER;
  }
  const pos = (k: SlideKey) => {
    const n = Number(form[`order_${k}`]);
    return Number.isFinite(n) ? n : SLIDE_KEYS.indexOf(k) + 1;
  };
  return [...shown].sort((a, b) => pos(a) - pos(b) || SLIDE_KEYS.indexOf(a) - SLIDE_KEYS.indexOf(b));
});

export const SLIDE_NOTE_MAX = 600;

/** Extra text admins add to slides (form fields note_<slide>), up to 600 characters each. */
export const slideNotesSchema = z.record(z.string(), z.string()).transform((form, ctx) => {
  const notes: Partial<Record<SlideKey, string>> = {};
  for (const k of SLIDE_KEYS) {
    const v = (form[`note_${k}`] ?? '').trim();
    if (!v) continue;
    if (v.length > SLIDE_NOTE_MAX) {
      ctx.addIssue({ code: 'custom', path: [`note_${k}`], message: `Keep slide text to ${SLIDE_NOTE_MAX} characters or fewer` });
      continue;
    }
    notes[k] = v;
  }
  return notes;
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
