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
  } else if (viewer) {
    actions = (
      <>
        <Link href="/pending" className="btn btn-outline btn-sm">
          Application status
        </Link>
        {signOutButton}
      </>
    );
  } else {
    actions = (
      <>
        <Link href="/login" className="font-display text-heading flex min-h-11 items-center px-3 text-[15px] font-bold no-underline">
          Log in
        </Link>
        <Link href="/join" className="btn btn-primary btn-sm">
          Join SCBNG
        </Link>
      </>
    );
  }

  return (
    <header className="border-teal bg-surface font-display text-heading border-b-4">
      <a href="#main" className="sr-only-focusable btn btn-primary absolute top-2 left-2 z-50">
        Skip to content
      </a>
      <div className="container-site flex flex-wrap items-center gap-x-7 gap-y-3 py-3.5">
        <Link href="/" className="flex min-h-14 flex-none flex-col justify-center leading-none no-underline">
          <span className="text-teal-text text-[26px] font-extrabold tracking-tight">SCBNG</span>
          <span className="text-ink-muted mt-1 text-[11px] font-bold sm:text-xs">{site.name}</span>
        </Link>
        <NavLinks items={approved ? memberNav : publicNav} actions={actions} />
      </div>
    </header>
  );
}
