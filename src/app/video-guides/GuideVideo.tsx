'use client';

/** One guide video. Starting it pauses any other video on the page, so only one plays at a time. */
export function GuideVideo({ file, title, preload = 'none' }: { file: string; title: string; preload?: 'none' | 'metadata' }) {
  const base = `/videos/members-guide/${file}`;
  return (
    <video
      className="bg-band block aspect-video w-full rounded-xl"
      controls
      playsInline
      preload={preload}
      poster={`${base}.webp`}
      aria-label={`Video: ${title}`}
      onPlay={(e) => {
        document.querySelectorAll('video').forEach((v) => {
          if (v !== e.currentTarget && !v.paused) v.pause();
        });
      }}
    >
      <source src={`${base}.mp4`} type="video/mp4" />
      Your browser can&apos;t play this video. <a href={`${base}.mp4`}>Download it</a> instead.
    </video>
  );
}
