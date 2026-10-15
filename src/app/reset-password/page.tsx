import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import { ResetForm } from './ResetForm';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage() {
  const viewer = await getViewer();
  return (
    <section className="container-site flex justify-center py-16">
      <div className="card flex w-full max-w-[480px] flex-col gap-4 p-7">
        <h1 className="font-display m-0 text-[28px] font-extrabold">Choose a new password</h1>
        {viewer ? (
          <ResetForm />
        ) : (
          <p className="m-0">
            This page opens from the link in your reset email. <Link href="/forgot-password">Request a new link</Link>.
          </p>
        )}
      </div>
    </section>
  );
}
