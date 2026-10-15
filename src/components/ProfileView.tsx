import Image from 'next/image';
import Link from 'next/link';
import type { PublicProfile, PublicStats } from '@/lib/data/public';
import { mediaUrl } from '@/lib/env';
import { Avatar } from './ui';
import { site } from '@/lib/content';

type Props = {
  profile: PublicProfile;
  stats: PublicStats;
  contact: { email: string | null; phone: string | null; membersOnly: boolean };
  viewerIsMember: boolean;
  isSelf?: boolean;
};

export function ProfileView({ profile: p, stats, contact, viewerIsMember, isSelf }: Props) {
  const name = `${p.first_name} ${p.last_name}`;
  const avatar = mediaUrl('profile-media', p.avatar_path);
  const logo = mediaUrl('profile-media', p.logo_path);
  const since = p.member_since ? new Date(p.member_since + 'T12:00:00Z').getUTCFullYear() : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="card overflow-hidden">
        <div className="bg-band h-40" />
        <div className="-mt-14 flex flex-wrap items-end gap-6 px-7 pb-7">
          <span className="border-surface bg-teal-tint relative flex h-[120px] w-[120px] flex-none items-center justify-center overflow-hidden rounded-full border-[6px]">
            {avatar ? <Image src={avatar} alt="" fill sizes="120px" className="object-cover" /> : <Avatar name={name} size={108} />}
          </span>
          <div className="min-w-0 flex-[1_1_300px] pb-1.5">
            <h1 className="font-display m-0 text-[32px] font-extrabold">{name}</h1>
            <p className="text-berry m-0 text-lg font-semibold">{p.business_name}</p>
            <p className="text-ink-muted m-0 text-[15px]">{[p.categories?.name, p.city, since ? `Member since ${since}` : null].filter(Boolean).join(' · ')}</p>
          </div>
          {!isSelf ? (
            <div className="flex flex-wrap gap-2 pb-1.5">
              <Link className="btn btn-primary btn-sm" href={viewerIsMember ? `/one-on-ones?partner=${p.id}` : '/login?next=/one-on-ones'}>
                Request a one-on-one
              </Link>
              <Link className="btn btn-outline btn-sm" href={viewerIsMember ? `/referrals?tab=business&to=${p.id}` : '/login?next=/referrals'}>
                Refer business
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5">
          <section className="card flex flex-col gap-2.5 p-6">
            <h2 className="h3">About</h2>
            <p className="text-ink-soft m-0">{p.about ?? 'This member hasn’t added an introduction yet.'}</p>
          </section>
          <section className="card flex flex-col gap-3 p-6">
            <h2 className="h3">How to refer me</h2>
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              {[
                { k: 'Ideal client', v: p.ideal_client },
                { k: 'Listen for', v: p.listen_for },
                { k: 'Service area', v: p.service_area },
              ].map((r) => (
                <div key={r.k} className="bg-canvas rounded-xl p-3.5">
                  <dt className="text-ink-muted text-[13px] font-bold tracking-[0.06em] uppercase">{r.k}</dt>
                  <dd className="m-0">{r.v ?? '—'}</dd>
                </div>
              ))}
            </dl>
            {p.services.length ? (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Services">
                {p.services.map((s) => (
                  <li key={s} className="pill bg-teal-tint text-teal-hover">
                    {s}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          {logo ? (
            <section className="card flex flex-col gap-3 p-6">
              <h2 className="h3">Logo</h2>
              <div className="relative h-40 w-full max-w-xs">
                <Image src={logo} alt={`${p.business_name} logo`} fill sizes="320px" className="object-contain" />
              </div>
            </section>
          ) : null}
        </div>
        <aside className="flex min-w-0 flex-[2_1_300px] flex-col gap-5">
          <section className="card flex flex-col gap-2.5 p-[22px]">
            <h2 className="h3">Contact</h2>
            {p.website ? (
              <div className="text-[15px]">
                <div className="text-ink-muted text-[13px] font-bold">WEBSITE</div>
                <a href={p.website} rel="noopener noreferrer nofollow" target="_blank">
                  {p.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            ) : null}
            {contact.email ? (
              <div className="text-[15px]">
                <div className="text-ink-muted text-[13px] font-bold">EMAIL</div>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </div>
            ) : null}
            {contact.phone ? (
              <div className="text-[15px]">
                <div className="text-ink-muted text-[13px] font-bold">PHONE</div>
                <a href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}>{contact.phone}</a>
              </div>
            ) : null}
            {contact.membersOnly ? (
              <p className="text-ink-muted m-0 text-[15px]">
                Email and phone are visible to <Link href="/login">logged-in members</Link>.
              </p>
            ) : null}
          </section>
          {stats ? (
            <section className="card flex flex-col gap-2.5 p-[22px]">
              <h2 className="h3">{site.name} activity</h2>
              <dl className="m-0 grid grid-cols-2 gap-2.5">
                {[
                  { k: 'Attendance', v: stats.attendance_pct === null ? '—' : `${stats.attendance_pct}%` },
                  { k: 'Referrals given (90 days)', v: String(stats.referrals_given) },
                  { k: 'One-on-ones (90 days)', v: String(stats.one_on_ones) },
                  { k: 'Members invited', v: String(stats.members_invited) },
                ].map((s) => (
                  <div key={s.k} className="bg-teal-tint flex flex-col-reverse rounded-xl p-3">
                    <dt className="text-ink-muted text-[13px]">{s.k}</dt>
                    <dd className="font-display text-heading m-0 text-[22px] font-extrabold">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
