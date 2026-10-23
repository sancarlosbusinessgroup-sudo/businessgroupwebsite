import type { EmailOtpType } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Link from 'next/link';
import { confirmEmailLink } from '@/app/actions/auth';
import { SubmitButton } from '@/components/forms';

export const metadata: Metadata = { title: 'Continue', robots: { index: false } };

const COPY: Partial<Record<EmailOtpType, { title: string; text: string; button: string; again: { href: string; label: string } }>> = {
  recovery: {
    title: 'Reset your password',
    text: 'Press Continue to choose a new password for your account.',
    button: 'Continue',
    again: { href: '/forgot-password', label: 'Request a new reset link' },
  },
  signup: {
    title: 'Confirm your email',
    text: 'Press the button to confirm your email address and finish your application.',
    button: 'Confirm my email',
    again: { href: '/login', label: 'Go to log in' },
  },
  email: {
    title: 'Confirm your email',
    text: 'Press the button to confirm your email address.',
    button: 'Confirm my email',
    again: { href: '/login', label: 'Go to log in' },
  },
  email_change: {
    title: 'Confirm your new email',
    text: 'Press the button to confirm the change to your email address.',
    button: 'Confirm my email',
    again: { href: '/login', label: 'Go to log in' },
  },
  invite: {
    title: 'Accept your invitation',
    text: 'Press Continue to set up your account.',
    button: 'Continue',
    again: { href: '/login', label: 'Go to log in' },
  },
};

/**
 * Landing page for links in Supabase auth emails. Opening the page does nothing:
 * email security scanners (Outlook Safe Links and similar) open every link in an
 * email, which used to spend the one-time token before the member clicked it.
 * The token is only used when the person presses the button (a POST).
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const type = (sp.type ?? 'recovery') as EmailOtpType;
  const copy = COPY[type] ?? COPY.recovery!;
  const complete = Boolean(sp.token_hash && COPY[type]);
  return (
    <section className="container-site flex justify-center py-16">
      <div className="card flex w-full max-w-[480px] flex-col gap-4 p-7">
        <h1 className="font-display m-0 text-[28px] font-extrabold">{copy.title}</h1>
        {complete ? (
          <form action={confirmEmailLink} className="flex flex-col gap-4">
            <input type="hidden" name="token_hash" value={sp.token_hash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={sp.next ?? ''} />
            <p className="m-0">{copy.text}</p>
            <SubmitButton pendingText="One moment…">{copy.button}</SubmitButton>
          </form>
        ) : (
          <p className="m-0">
            This link is incomplete. Please use the button in the email, or <Link href={copy.again.href}>{copy.again.label}</Link>.
          </p>
        )}
      </div>
    </section>
  );
}
