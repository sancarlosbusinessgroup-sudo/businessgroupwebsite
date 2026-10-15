import type { Metadata } from 'next';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <section className="container-site flex justify-center py-16">
      <div className="card flex w-full max-w-[480px] flex-col gap-4 p-7">
        <h1 className="font-display m-0 text-[28px] font-extrabold">Reset your password</h1>
        <p className="text-ink-soft m-0">Enter your email and we&apos;ll send you a link to choose a new password.</p>
        <ForgotForm />
      </div>
    </section>
  );
}
