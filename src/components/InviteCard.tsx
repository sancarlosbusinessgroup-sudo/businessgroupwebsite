import { guestStatusLabels, site } from '@/lib/content';
import { formatShortDate } from '@/lib/dates';
import { CopyLink } from './CopyLink';
import { Pill } from './ui';

const tone = { requested: 'gray', visited: 'amber', applied: 'teal', joined: 'green' } as const;

type Guest = { id: string; first_name: string; last_name: string; status: keyof typeof guestStatusLabels; created_at: string };

/** "Invite a visitor": personal /visit?ref= link plus the member's own recent guests. */
export function InviteCard({ link, guests }: { link: string; guests: Guest[] }) {
  const invite = encodeURIComponent(`I'd love for you to visit ${site.name} as my guest: ${link}`);
  return (
    <section id="invite" className="bg-band text-on-band flex scroll-mt-6 flex-col gap-3.5 rounded-[20px] p-6" aria-labelledby="invite-h">
      <h2 id="invite-h" className="font-display text-on-band m-0 text-[22px] font-extrabold">
        Invite a visitor
      </h2>
      <CopyLink url={link} />
      <p className="text-on-band-muted m-0 text-[15px]">Guests who request an invite or apply through this link are credited to you as visitors brought.</p>
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-ghost-band btn-sm" href={`mailto:?subject=${encodeURIComponent(`Join me at ${site.name}`)}&body=${invite}`}>
          Email an invite
        </a>
        <a className="btn btn-ghost-band btn-sm" href={`sms:?&body=${invite}`}>
          Text an invite
        </a>
        <a
          className="btn btn-ghost-band btn-sm"
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on LinkedIn
        </a>
      </div>
      {guests.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-sky m-0 text-[13px] font-bold tracking-[0.12em] uppercase">Your recent guests</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {guests.map((g) => (
              <li key={g.id} className="bg-band-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-[15px]">
                <span>
                  <strong className="text-on-band">
                    {g.first_name} {g.last_name}
                  </strong>{' '}
                  <span className="text-on-band-muted">· {formatShortDate(new Date(g.created_at))}</span>
                </span>
                <Pill tone={tone[g.status]}>{guestStatusLabels[g.status]}</Pill>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
