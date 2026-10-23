import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Avatar, EmptyState, PageHero } from '@/components/ui';
import { getViewer, isApproved } from '@/lib/auth';
import { getCategories, getDirectory, getMemberCount } from '@/lib/data/public';
import { createClient } from '@/lib/supabase/server';
import { filterDirectory, paginate } from '@/lib/directory';
import { mediaUrl } from '@/lib/env';
import { barpSheetUrl, site } from '@/lib/content';
import { ChampionBadge } from '@/components/ChampionBadge';
import { getCurrentChampion } from '@/lib/data/champion';

export const metadata: Metadata = { title: 'Members' };

const PAGE_SIZE = 24;
const bands = ['bg-teal-tint', 'bg-berry-tint', 'bg-green-tint', 'bg-amber-tint'];

type Search = { q?: string; category?: string; sort?: string; page?: string };

export default async function MembersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [all, categories, total, viewer, champion] = await Promise.all([getDirectory(), getCategories(), getMemberCount(), getViewer(), getCurrentChampion()]);
  const member = isApproved(viewer);
  // Contact details: members only (RLS returns nothing to anyone else anyway).
  const contacts = new Map<string, { email: string; phone: string | null }>();
  if (member) {
    const supabase = await createClient();
    const { data } = await supabase.from('member_contacts').select('profile_id, email, phone');
    for (const c of data ?? []) contacts.set(c.profile_id, { email: c.email, phone: c.phone });
  }
  const filtered = filterDirectory(all, sp);
  const { page, pages, items } = paginate(filtered, Number(sp.page ?? 1), PAGE_SIZE);
  const usedCategories = categories.filter((c) => all.some((p) => p.categories?.name === c.name));
  const pageHref = (n: number) => {
    const s = new URLSearchParams();
    if (sp.q) s.set('q', sp.q);
    if (sp.category) s.set('category', sp.category);
    if (sp.sort) s.set('sort', sp.sort);
    s.set('page', String(n));
    return `/members?${s.toString()}`;
  };

  return (
    <>
      <PageHero
        crumb="Members"
        title={`Our ${site.name} members`}
        lead="Each person here represents a local business that believes in connection, accountability and growing together. Interested in visiting? Reach out to any member below."
      />
      <section className="container-site flex flex-col gap-6 pt-8 pb-14">
        <form key={`${sp.q ?? ''}|${sp.category ?? ''}|${sp.sort ?? ''}`} role="search" action="/members" className="card flex flex-wrap items-end gap-4 p-5">
          <div className="min-w-0 flex-[2_1_280px]">
            <label className="label" htmlFor="kw">
              Keyword
            </label>
            <input id="kw" name="q" type="search" className="field" placeholder="Search name, business or service" defaultValue={sp.q ?? ''} maxLength={100} />
          </div>
          <div className="min-w-0 flex-[1_1_220px]">
            <label className="label" htmlFor="cat">
              Category
            </label>
            <select id="cat" name="category" className="field" defaultValue={sp.category ?? ''}>
              <option value="">All categories</option>
              {usedCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-[1_1_200px]">
            <label className="label" htmlFor="sort">
              Sort
            </label>
            <select id="sort" name="sort" className="field" defaultValue={sp.sort ?? 'name'}>
              <option value="name">Business name A–Z</option>
              <option value="newest">Newest members</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            <Link href="/members" className="btn btn-outline btn-sm">
              Clear
            </Link>
          </div>
        </form>

        <div className="text-ink-muted flex flex-wrap justify-between gap-2 text-[15px]">
          <p className="m-0" aria-live="polite">
            Showing <strong className="text-heading">{filtered.length}</strong> of {total} member businesses
          </p>
          {member ? (
            <div className="flex flex-wrap gap-2">
              <a className="btn btn-outline btn-sm" href={barpSheetUrl} target="_blank" rel="noopener noreferrer">
                BARP Google Sheet<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <a className="btn btn-outline btn-sm" href="/members/export?format=vcf" download>
                Download contacts (vCard)
              </a>
            </div>
          ) : (
            <p className="m-0">Logged-in members also see phone and email</p>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState title="No members match your search">
            <Link href="/members">Clear the filters</Link>
          </EmptyState>
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 p-0">
            {items.map((p, i) => {
              const photo = mediaUrl('profile-media', p.avatar_path);
              const name = `${p.first_name} ${p.last_name}`;
              const contact = contacts.get(p.id);
              return (
                <li key={p.id}>
                  <article className="card hover:border-teal relative flex h-full flex-col overflow-hidden">
                    <span className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden ${bands[i % bands.length]}`}>
                      {photo ? (
                        <Image src={photo} alt="" fill sizes="(max-width: 640px) 100vw, 300px" className="object-cover object-top" />
                      ) : (
                        <span className="bg-surface flex h-[150px] w-[150px] items-center justify-center rounded-full">
                          <Avatar name={name} size={132} index={i} />
                        </span>
                      )}
                      {champion?.profileId === p.id ? <ChampionBadge month={champion.label} compact className="absolute top-3 left-3" /> : null}
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5 p-[18px]">
                      <span className="text-ink-muted text-xs font-bold tracking-[0.08em] uppercase">{p.categories?.name ?? 'Member'}</span>
                      <h2 className="font-display m-0 text-[19px] leading-tight font-bold">
                        <Link href={`/members/${p.slug}`} className="text-teal-text no-underline after:absolute after:inset-0 after:content-['']">
                          {name}
                        </Link>
                      </h2>
                      <span className="text-heading text-[15px] font-semibold">{p.business_name}</span>
                      {p.weekly_ask ? (
                        <p className="bg-teal-tint text-heading m-0 rounded-lg px-2.5 py-1.5 text-[14px]">
                          <span className="text-teal-hover font-bold">Looking for: </span>
                          {p.weekly_ask}
                        </p>
                      ) : null}
                      {p.about ? <span className="text-ink-soft line-clamp-4 text-[15px]">{p.about}</span> : null}
                      {contact ? (
                        <ul
                          className="border-line-soft relative z-10 m-0 mt-auto flex list-none flex-col gap-0.5 border-t p-0 pt-2.5 text-[14px]"
                          aria-label={`Contact ${name}`}
                        >
                          <li className="truncate">
                            <a href={`mailto:${contact.email}`}>{contact.email}</a>
                          </li>
                          {contact.phone ? (
                            <li>
                              <a href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}>{contact.phone}</a>
                            </li>
                          ) : null}
                          {p.website ? (
                            <li className="truncate">
                              <a href={p.website} target="_blank" rel="noopener noreferrer nofollow">
                                {p.website.replace(/^https?:\/\//, '')}
                              </a>
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="flex justify-center gap-1.5">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={pageHref(n)}
                aria-current={n === page ? 'page' : undefined}
                className={`btn btn-sm min-w-11 px-0 ${n === page ? 'btn-outline' : 'text-heading'}`}
              >
                {n}
              </Link>
            ))}
          </nav>
        ) : null}
        <p className="text-ink-muted m-0 text-center text-sm">
          <strong>Information is maintained by the respective business</strong> and may change over time. Please contact each business directly to confirm
          services, availability, pricing, hours and service area.
        </p>
      </section>
    </>
  );
}
