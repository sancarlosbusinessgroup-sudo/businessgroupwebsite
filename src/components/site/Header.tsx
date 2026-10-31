import Image from 'next/image';
import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import { memberNav, publicNav, site } from '@/lib/content';
import { signOut } from '@/app/actions/auth';
import { Avatar } from '../ui';
import { NavLinks } from './NavLinks';

export async function Header() {
  const viewer = await getViewer();
  const profile = viewer?.profile ?? null;
  const approved = profile?.status === 'approved';
  const name = profile ? `${profile.first_name} ${profile.last_name}` : '';

  const signOutButton = (
    <form action={signOut}>
      <button type="submit" className="font-display text-ink-muted flex min-h-11 cursor-pointer items-center border-0 bg-transparent px-1.5 text-sm font-bold">
        Log out
      </button>
    </form>
  );

  let actions;
  if (approved) {
    actions = (
      <>
        <Link href="/dashboard" className="font-display text-heading flex min-h-11 items-center gap-2.5 text-[15px] font-bold no-underline">
          <Avatar name={name} size={38} />
          {name}
        </Link>
        {profile?.role === 'admin' ? (
          <Link href="/admin" className="font-display flex min-h-11 items-center px-1.5 text-sm font-bold no-underline">
            Admin
          </Link>
        ) : null}
        {signOutButton}
      </>
    );
  } else {
    actions = (
      <>
        <Link href="/login" className="font-display text-heading flex min-h-11 items-center px-3 text-[15px] font-bold no-underline">
          Log in
        </Link>
        <Link href="/visit#request" className="btn btn-primary btn-sm">
          Request for an Invite
        </Link>
      </>
    );
  }

  return (
    <header className="border-brand bg-surface font-display text-heading border-b-4">
      <a href="#main" className="sr-only-focusable btn btn-primary absolute top-2 left-2 z-50">
        Skip to content
      </a>
      <div className="container-site flex flex-wrap items-center gap-x-7 gap-y-3 py-3.5">
        <Link href="/" className="flex min-h-14 flex-none items-center gap-3 leading-none no-underline" aria-label={`${site.name}, home`}>
          <Image src="/images/barp-logo-mark.png" alt="" width={52} height={52} priority className="h-[52px] w-[52px]" />
          <span className="flex flex-col gap-1" aria-hidden="true">
            <span className="text-heading text-[24px] font-extrabold tracking-tight">Bay Area</span>
            <span className="text-teal-text text-[15px] font-semibold tracking-[0.04em]">Referral Partners</span>
          </span>
        </Link>
        <NavLinks items={approved ? memberNav : publicNav} actions={actions} />
      </div>
    </header>
  );
}
