export default function Loading() {
  return (
    <div className="container-site flex flex-col gap-4 py-12" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="bg-line-soft h-10 w-2/3 max-w-[520px] animate-pulse rounded-xl" />
      <div className="bg-line-soft h-5 w-1/2 max-w-[420px] animate-pulse rounded-lg" />
      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-line-soft h-40 animate-pulse rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
