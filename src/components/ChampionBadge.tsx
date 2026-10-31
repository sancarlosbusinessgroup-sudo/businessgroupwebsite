/**
 * "Current BARP Champion · October 2026" badge (owner, 2026-10-23). Owner meeting 2026-10-30: "Current" so people know it moves,
 * and a prize rosette instead of the small pill, which looked uninspiring.
 */
export function ChampionBadge({ month, className = '', compact = false }: { month: string; className?: string; compact?: boolean }) {
  return (
    <span
      className={`font-display inline-flex items-center gap-2 rounded-full bg-[#fde68a] font-extrabold text-[#5b3a00] shadow-md ring-2 ring-[#f59e0b] [text-shadow:none] ${compact ? 'py-1 pr-3 pl-1 text-[13px]' : 'py-1.5 pr-4 pl-1.5 text-base'} ${className}`}
    >
      <ChampionRosette size={compact ? 26 : 34} />
      <span>
        Current BARP Champion{compact ? '' : ` · ${month}`}
        {compact ? <span className="sr-only"> · {month}</span> : null}
      </span>
    </span>
  );
}

/** Gold prize rosette with ribbons (decorative). */
export function ChampionRosette({ size = 64, className = '' }: { size?: number; className?: string }) {
  const petals = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 64 80" className={`flex-none ${className}`} aria-hidden="true">
      {/* Ribbons */}
      <path d="M22 44 L12 78 L21 72 L27 79 L32 48 Z" fill="#0c7b74" />
      <path d="M42 44 L52 78 L43 72 L37 79 L32 48 Z" fill="#00a3ab" />
      {/* Scalloped edge */}
      <g transform="translate(32 30)">
        {petals.map((a) => (
          <circle key={a} cx="0" cy="-25" r="6.5" fill="#f59e0b" transform={`rotate(${a})`} />
        ))}
        <circle r="25" fill="#f59e0b" />
        <circle r="20" fill="#fde68a" stroke="#d97706" strokeWidth="1.5" />
        {/* Trophy */}
        <path
          d="M-7 -10 H7 V-3 A7 7 0 0 1 -7 -3 Z M-7 -8 H-10 A3 3 0 0 0 -7 -2 M7 -8 H10 A3 3 0 0 1 7 -2 M0 4 V8 M-5 11 H5"
          fill="none"
          stroke="#92400e"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
