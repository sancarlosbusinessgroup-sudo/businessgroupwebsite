import { adminHelp, type AdminTab } from '@/lib/admin-help';

/** "How This Works" under each Admin page title: a closed accordion that opens when clicked (owner, 2026-10-30). */
export function HowThisWorks({ tab }: { tab: AdminTab }) {
  return (
    <details className="how-this-works card group overflow-hidden">
      <summary className="font-display text-heading hover:bg-teal-tint flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-base font-bold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className="bg-teal-tint text-teal-text flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold">
            ?
          </span>
          How This Works
        </span>
        <span aria-hidden="true" className="text-teal-text transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ul className="text-ink-soft border-line m-0 flex list-disc flex-col gap-2 border-t py-4 pr-5 pl-10 text-[15px] leading-relaxed">
        {adminHelp[tab].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </details>
  );
}
