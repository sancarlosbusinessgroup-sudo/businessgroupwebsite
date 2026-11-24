import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHero } from '@/components/ui';
import { memberGuideVideos, site } from '@/lib/content';
import { requireMember } from '@/lib/auth';
import { GuideVideo } from './GuideVideo';

export const metadata: Metadata = {
  title: 'Video Guides',
  description: `Short videos showing how to use the ${site.name} members' website.`,
  robots: { index: false, follow: false },
};

/** Support → Video Guides (owner, 2026-11-24): the Member's Guide, as one full video and one short clip per chapter. */
export default async function VideoGuidesPage() {
  // Members only, like Support → Contact Us.
  await requireMember('/video-guides');
  const { full, chapters } = memberGuideVideos;
  return (
    <>
      <PageHero
        crumb="Video Guides"
        title="Video Guides"
        lead="Short videos that show you how to use the members' website, step by step. Watch the full tour, or jump to the chapter you need."
      />

      <section className="container-site flex flex-col gap-6 pt-10 pb-6" aria-labelledby="guide-h">
        <div className="flex flex-col gap-2">
          <p className="eyebrow m-0">Member&apos;s Guide</p>
          <h2 id="guide-h" className="h2">
            The full tour
          </h2>
          <p className="text-ink-soft m-0 max-w-[760px]">
            All 14 chapters in one video ({full.duration}). A voice reads each step aloud, and the captions at the bottom say the same thing. They were recorded
            with made-up sample members, so the names you see are not real.
          </p>
        </div>
        <div className="card overflow-hidden p-2 sm:p-3">
          <GuideVideo file={full.file} title={full.title} preload="metadata" />
        </div>
      </section>

      <section className="container-site flex flex-col gap-5 pt-6 pb-16" aria-labelledby="chapters-h">
        <div className="flex flex-col gap-2">
          <h2 id="chapters-h" className="h2">
            Chapter by chapter
          </h2>
          <p className="text-ink-soft m-0">Each chapter is about a minute long.</p>
        </div>
        <ol className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((c, i) => (
            <li key={c.file} className="card flex flex-col gap-3 p-3">
              <GuideVideo file={c.file} title={c.title} />
              <div className="flex flex-col gap-1 px-1 pb-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display m-0 text-lg font-bold">
                    {i + 1}. {c.title}
                  </h3>
                  <span className="text-ink-muted flex-none text-sm">{c.duration}</span>
                </div>
                <p className="text-ink-soft m-0 text-[15px]">{c.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-ink-soft m-0">
          Still stuck? <Link href="/support">Contact us</Link> and the support team will help.
        </p>
      </section>
    </>
  );
}
