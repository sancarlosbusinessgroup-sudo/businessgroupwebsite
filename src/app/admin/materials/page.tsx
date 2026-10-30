import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { EmptyState } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatShortDate } from '@/lib/dates';
import { loadMaterials, type Material } from '@/lib/data/materials';
import { STORAGE_PLAN_BYTES, formatBytes, slideLabel, toSlideKey } from '@/lib/slides';

export const metadata: Metadata = { title: 'Presentation materials' };
export const dynamic = 'force-dynamic';

const kindLabel: Record<Material['kind'], string> = {
  pdf: 'PDF',
  powerpoint: 'PowerPoint',
  image: 'Image',
  youtube: 'YouTube video',
  link: 'Website link',
};

const afterLabel = (k: string) => {
  const key = toSlideKey(k);
  return key ? slideLabel(key) : k;
};

/** Every file, video and website added to past and upcoming meeting slides, with the storage each file uses (owner, 2026-10-27). */
export default async function AdminMaterialsPage() {
  await requireAdmin();
  const { materials, fileBytes, fileCount, linkCount } = await loadMaterials();
  const share = (fileBytes / STORAGE_PLAN_BYTES) * 100;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <h1 className="font-display m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold">Presentation materials</h1>
        <HowThisWorks tab="/admin/materials" />
        <AdminNav current="/admin/materials" />

        <section className="card flex flex-col gap-3 p-[22px]" aria-labelledby="space-h">
          <h2 id="space-h" className="font-display m-0 text-[22px] font-extrabold">
            Space used
          </h2>
          <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border-line rounded-[14px] border p-4">
              <dt className="text-ink-muted text-sm font-semibold">Uploaded files</dt>
              <dd className="font-display m-0 text-2xl font-extrabold">{fileCount}</dd>
            </div>
            <div className="border-line rounded-[14px] border p-4">
              <dt className="text-ink-muted text-sm font-semibold">File storage they use</dt>
              <dd className="font-display m-0 text-2xl font-extrabold">{formatBytes(fileBytes)}</dd>
              <dd className="text-ink-muted m-0 text-sm">{share < 0.1 ? 'under 0.1' : share.toFixed(1)}% of the 1 GB included in the free plan</dd>
            </div>
            <div className="border-line rounded-[14px] border p-4">
              <dt className="text-ink-muted text-sm font-semibold">Videos and website links</dt>
              <dd className="font-display m-0 text-2xl font-extrabold">{linkCount}</dd>
              <dd className="text-ink-muted m-0 text-sm">No file storage, only a short database record each</dd>
            </div>
          </dl>
        </section>

        <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="list-h">
          <h2 id="list-h" className="font-display m-0 text-[22px] font-extrabold">
            All materials, newest meeting first
          </h2>
          {materials.length ? (
            <div className="overflow-x-auto" role="region" aria-label="Presentation materials table" tabIndex={0}>
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-line border-b">
                    <th scope="col" className="py-2 pr-4">
                      Meeting
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      Shown after
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      Type
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      Title
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right">
                      Size
                    </th>
                    <th scope="col" className="py-2">
                      Open
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => {
                    const name = m.title || kindLabel[m.kind];
                    const href = m.kind === 'link' || m.kind === 'youtube' ? m.url : `/present/${m.meetingSlug}/material/${m.id}`;
                    return (
                      <tr key={m.id} className="border-line-soft border-b align-top">
                        <td className="py-2.5 pr-4">
                          <Link href={`/present/${m.meetingSlug}`} className="font-semibold">
                            {formatShortDate(new Date(m.startsAt))}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4">{afterLabel(m.afterSlide)}</td>
                        <td className="py-2.5 pr-4">
                          {kindLabel[m.kind]}
                          {m.kind === 'pdf' && m.pageCount ? ` · ${m.pageCount} page${m.pageCount === 1 ? '' : 's'}` : ''}
                        </td>
                        <td className="py-2.5 pr-4">{name}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{m.bytes === null ? '—' : formatBytes(m.bytes)}</td>
                        <td className="py-2.5">
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="font-bold">
                              Open<span className="sr-only"> {name}</span>
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No materials yet">Files, videos and website links added in Customize slides appear here.</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
