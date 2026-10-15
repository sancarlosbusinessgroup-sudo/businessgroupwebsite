import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Avatar, EmptyState, PageHero } from '@/components/ui';
import { getCategories, getDirectory, getMemberCount } from '@/lib/data/public';
import { filterDirectory, paginate } from '@/lib/directory';
import { mediaUrl } from '@/lib/env';
import { site } from '@/lib/content';

export const metadata: Metadata = { title: 'Members' };

const PAGE_SIZE = 24;
const bands = ['bg-teal-tint', 'bg-berry-tint', 'bg-green-tint', 'bg-amber-tint'];

type Search = { q?: string; category?: string; sort?: string; page?: string };

export default async function MembersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [all, categories, total] = await Promise.all([getDirectory(), getCategories(), getMemberCount()]);
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
        <form role="search" action="/members" className="card flex flex-wrap items-end gap-4 p-5">
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
          <p className="m-0">Logged-in members also see phone and email</p>
        </div>

        {items.length === 0 ? (
          <EmptyState title="No members match your search">
            <Link href="/members">Clear the filters</Link>
          </EmptyState>
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 p-0">
            {items.map((p, i) => {
              const logo = mediaUrl('profile-media', p.logo_path);
              const name = `${p.first_name} ${p.last_name}`;
              return (
                <li key={p.id}>
                  <Link
                    href={`/members/${p.slug}`}
                    className="card text-ink hover:border-teal hover:text-ink flex h-full flex-col overflow-hidden no-underline"
                  >
                    <span className={`relative flex h-[150px] items-center justify-center ${bands[i % bands.length]}`}>
                      {logo ? (
                        <Image src={logo} alt="" fill sizes="300px" className="object-contain p-4" />
                      ) : (
                        <span className="bg-surface flex h-[84px] w-[84px] items-center justify-center rounded-full">
                          <Avatar name={p.business_name} size={64} index={i} />
                        </span>
                      )}
                    </span>
                    <span className="flex flex-1 flex-col gap-1.5 p-[18px]">
                      <span className="text-ink-muted text-xs font-bold tracking-[0.08em] uppercase">{p.categories?.name ?? 'Member'}</span>
                      <span className="font-display text-berry text-[19px] leading-tight font-bold">{p.business_name}</span>
                      <span className="text-heading text-[15px] font-semibold">{name}</span>
                      {p.about ? <span className="text-ink-soft line-clamp-4 text-[15px]">{p.about}</span> : null}
                    </span>
                  </Link>
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
