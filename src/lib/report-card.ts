import { localDateKey } from './dates';

// Member report cards (owner, 2026-11-24): a quarterly check-in sheet per member for the Member Coach, from what the
// website tracks (attendance, one-on-ones, referrals, visitors, presentations), against goals admins set. Tracking on
// the website started in October 2026, so the first quarter with data is Q4 2026.

export const FIRST_QUARTER = '2026-Q4';

export type Quarter = `${number}-Q${1 | 2 | 3 | 4}`;
export type QuarterRange = { key: Quarter; label: string; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, '0');

/** Pacific calendar dates; `to` is exclusive (same as the stats functions). */
export function quarterRange(key: string): QuarterRange | null {
  const m = key.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  const y = Number(m[1]);
  const q = Number(m[2]);
  const startMonth = (q - 1) * 3 + 1;
  const end = startMonth + 3;
  return {
    key: key as Quarter,
    label: `Q${q} ${y} (${['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][q - 1]})`,
    from: `${y}-${pad(startMonth)}-01`,
    to: end > 12 ? `${y + 1}-01-01` : `${y}-${pad(end)}-01`,
  };
}

export function quarterOf(date: Date): Quarter {
  const day = localDateKey(date);
  const y = Number(day.slice(0, 4));
  const q = Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1;
  return `${y}-Q${q}` as Quarter;
}

/** Every quarter from the first one with data to the current one, newest first. */
export function quarterOptions(now: Date = new Date()): QuarterRange[] {
  const out: QuarterRange[] = [];
  const current = quarterOf(now);
  let [y, q] = [Number(current.slice(0, 4)), Number(current.slice(-1))];
  for (;;) {
    const r = quarterRange(`${y}-Q${q}`)!;
    out.push(r);
    if (r.key === FIRST_QUARTER || y < 2026) break;
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
  }
  return out;
}

export type Goals = { one_on_ones: number | null; referrals: number | null; visitors: number | null; attendance_pct: number | null };

export type ReportCardInput = {
  meetingsHeld: number;
  attended: number;
  substitutes: number;
  missed: number;
  late: number;
  leftEarly: number;
  oneOnOnes: number;
  referralsGiven: number;
  referralsReceived: number;
  closedGiven: number;
  closedReceived: number;
  visitors: number;
  presentations: number;
};

export type ReportCardLine = { key: string; label: string; value: string; goal: string | null; met: boolean | null };

export const attendancePct = (c: Pick<ReportCardInput, 'meetingsHeld' | 'attended'>) =>
  c.meetingsHeld ? Math.round((c.attended / c.meetingsHeld) * 100) : null;

/** The lines of one member's report card, with each goal and whether it was met (null when there is no goal). */
export function reportCardLines(c: ReportCardInput, goals: Goals): ReportCardLine[] {
  const pct = attendancePct(c);
  const vs = (n: number, goal: number | null) => (goal == null ? null : n >= goal);
  return [
    {
      key: 'attendance',
      label: 'Meetings attended',
      value: c.meetingsHeld
        ? `${c.attended} of ${c.meetingsHeld} (${pct}%)${c.substitutes ? `, ${c.substitutes} with a substitute` : ''}`
        : 'No meetings with attendance taken',
      goal: goals.attendance_pct == null ? null : `${goals.attendance_pct}%`,
      met: goals.attendance_pct == null || pct == null ? null : pct >= goals.attendance_pct,
    },
    { key: 'missed', label: 'Missed meetings', value: String(c.missed), goal: null, met: null },
    { key: 'late', label: 'Arrived late', value: String(c.late), goal: null, met: null },
    { key: 'left_early', label: 'Left early', value: String(c.leftEarly), goal: null, met: null },
    {
      key: 'one_on_ones',
      label: 'One-on-ones (confirmed)',
      value: String(c.oneOnOnes),
      goal: goals.one_on_ones == null ? null : String(goals.one_on_ones),
      met: vs(c.oneOnOnes, goals.one_on_ones),
    },
    {
      key: 'referrals',
      label: 'Referrals given',
      value: String(c.referralsGiven),
      goal: goals.referrals == null ? null : String(goals.referrals),
      met: vs(c.referralsGiven, goals.referrals),
    },
    { key: 'referrals_received', label: 'Referrals received', value: String(c.referralsReceived), goal: null, met: null },
    { key: 'closed', label: 'Closed business (given / received)', value: `${c.closedGiven} / ${c.closedReceived}`, goal: null, met: null },
    {
      key: 'visitors',
      label: 'Visitors brought',
      value: String(c.visitors),
      goal: goals.visitors == null ? null : String(goals.visitors),
      met: vs(c.visitors, goals.visitors),
    },
    { key: 'presentations', label: 'Presentations given', value: String(c.presentations), goal: null, met: null },
  ];
}

/** "3 of 4 goals met", or null when no goals are set. */
export function goalsSummary(lines: ReportCardLine[]): { met: number; total: number } | null {
  const withGoal = lines.filter((l) => l.met !== null);
  if (!withGoal.length) return null;
  return { met: withGoal.filter((l) => l.met).length, total: withGoal.length };
}
