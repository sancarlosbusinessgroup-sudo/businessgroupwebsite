import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/lib/content';

const quick = [
  { href: '/', label: 'Home' },
  { href: '/members', label: 'Members' },
  { href: '/group-meetings', label: 'Meetings' },
  { href: '/events', label: 'Member events' },
  { href: '/visit', label: 'Visitors' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About' },
];
const members = [
  { href: '/login', label: 'Log in' },
  { href: '/join', label: 'Apply to join' },
  { href: '/dashboard', label: 'Growth dashboard' },
  { href: '/referrals', label: 'Referral tracker' },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-band text-on-band-muted border-brand border-t-4 text-[15px] leading-relaxed">
      <div className="container-site flex flex-col gap-9 pt-14 pb-7">
        <div className="flex flex-wrap gap-10">
          <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-3.5">
            <p className="font-display text-on-band m-0 flex items-center gap-3 text-[22px] font-extrabold">
              <Image src="/images/logo-mark.png" alt="" width={44} height={44} className="h-11 w-11" />
              {site.name}
            </p>
            <p className="m-0 max-w-[460px]">
              Proudly supporting business connections across the San Francisco Bay Area Peninsula, including {site.serviceArea}.
            </p>
          </div>
          <nav aria-label="Quick links" className="flex flex-[1_1_160px] flex-col gap-1.5">
            <h2 className="font-display text-sky m-0 mb-1 text-[13px] font-bold tracking-[0.12em] uppercase">Quick links</h2>
            {quick.map((l) => (
              <Link key={l.href} href={l.href} className="text-on-band no-underline hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Members" className="flex flex-[1_1_160px] flex-col gap-1.5">
            <h2 className="font-display text-sky m-0 mb-1 text-[13px] font-bold tracking-[0.12em] uppercase">Members</h2>
            {members.map((l) => (
              <Link key={l.href} href={l.href} className="text-on-band no-underline hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-band-line flex flex-wrap justify-between gap-3 border-t pt-5 text-sm">
          <p className="m-0">
            © {year} {site.shortName}
          </p>
          <div className="flex gap-[18px]">
            <Link href="/bylaws" className="text-on-band-muted">
              Bylaws &amp; procedures
            </Link>
            <Link href="/terms" className="text-on-band-muted">
              Terms of use
            </Link>
            <Link href="/privacy" className="text-on-band-muted">
              Privacy statement
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
