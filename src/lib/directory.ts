type Listable = {
  business_name: string;
  first_name: string;
  last_name: string;
  about: string | null;
  categories: { name: string } | null;
  approved_at: string | null;
};

export type DirectoryQuery = { q?: string; category?: string; sort?: string };

export function filterDirectory<T extends Listable>(items: T[], { q, category, sort }: DirectoryQuery): T[] {
  const needle = (q ?? '').trim().toLowerCase().slice(0, 100);
  let out = items.filter((p) => {
    if (category && p.categories?.name !== category) return false;
    if (!needle) return true;
    return [p.business_name, `${p.first_name} ${p.last_name}`, p.categories?.name ?? '', p.about ?? ''].join(' ').toLowerCase().includes(needle);
  });
  if (sort === 'newest') {
    out = [...out].sort((a, b) => (b.approved_at ?? '').localeCompare(a.approved_at ?? ''));
  } else {
    out = [...out].sort((a, b) => a.business_name.localeCompare(b.business_name));
  }
  return out;
}

export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), pages);
  return { page: p, pages, items: items.slice((p - 1) * size, p * size) };
}
