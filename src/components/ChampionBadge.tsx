/** "BARP Champion · October 2026" badge for the current champion (owner, 2026-10-23). */
export function ChampionBadge({ month, className = '', compact = false }: { month: string; className?: string; compact?: boolean }) {
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 rounded-full bg-[#fde68a] font-extrabold text-[#5b3a00] shadow-sm ring-1 ring-[#f59e0b] [text-shadow:none] ${compact ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
      BARP Champion{compact ? '' : ` · ${month}`}
      {compact ? <span className="sr-only"> · {month}</span> : null}
    </span>
  );
}
