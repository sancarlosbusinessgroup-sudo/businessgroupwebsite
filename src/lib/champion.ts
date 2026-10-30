// BARP Champion scoring. Pure functions: the data is loaded in lib/data/champion.ts.
// Owner, 2026-10-30: just three things score, one point each: a referral given, a one-on-one done, a meeting
// attended. (Was referral 5, closed +10, one-on-one 3, visitor 4/+10, meeting 2/substitute 1, presentation 3.)
// Closed business, visitors, substitutes and presentations are still counted and shown, but earn no points.

export const CHAMPION_POINTS = {
  referral: 1,
  oneOnOne: 1,
  meeting: 1,
} as const;

/** Members must attend at least this share of the month's meetings (where attendance was taken) to qualify. */
export const CHAMPION_MIN_ATTENDANCE = 0.75;

export type ChampionInput = {
  members: { id: string; name: string }[];
  /** Referral slips filed in the month, by giver. */
  referrals: { from_id: string | null }[];
  /** Referrals marked closed business in the month (closed_at in the month), by giver. */
  closed: { from_id: string | null; amount: number | null }[];
  /** Confirmed one-on-ones met in the month. */
  oneOnOnes: { reporter_id: string | null; partner_id: string | null }[];
  /** Invited guests who attended a meeting in the month, by inviting member. */
  visitors: { referrer_id: string | null }[];
  /** People invited by a member who were approved as members in the month. */
  joined: { referred_by: string | null }[];
  /** Meetings in the month whose attendance was taken. */
  meetingsTaken: number;
  /** Attendance rows for those meetings. */
  attendance: { profile_id: string; status: string; substitute: boolean }[];
  /** Presentations (5- or 10-minute) given at meetings in the month. */
  presentations: { profile_id: string | null }[];
};

export type ChampionRow = {
  id: string;
  name: string;
  points: number;
  referrals: number;
  closed: number;
  closedAmount: number;
  oneOnOnes: number;
  visitors: number;
  joined: number;
  meetings: number;
  substitutes: number;
  presentations: number;
  attendanceShare: number | null;
  eligible: boolean;
};

export function scoreChampion(input: ChampionInput): ChampionRow[] {
  const rows = new Map<string, ChampionRow>(
    input.members.map((m) => [
      m.id,
      {
        id: m.id,
        name: m.name,
        points: 0,
        referrals: 0,
        closed: 0,
        closedAmount: 0,
        oneOnOnes: 0,
        visitors: 0,
        joined: 0,
        meetings: 0,
        substitutes: 0,
        presentations: 0,
        attendanceShare: null,
        eligible: true,
      },
    ]),
  );
  const get = (id: string | null) => (id ? rows.get(id) : undefined);

  for (const r of input.referrals) {
    const row = get(r.from_id);
    if (row) row.referrals++;
  }
  for (const r of input.closed) {
    const row = get(r.from_id);
    if (row) {
      row.closed++;
      row.closedAmount += Number(r.amount ?? 0);
    }
  }
  // One-on-ones count once per pair per month, for both members.
  const pairs = new Set<string>();
  for (const o of input.oneOnOnes) {
    if (!o.reporter_id || !o.partner_id) continue;
    const key = [o.reporter_id, o.partner_id].sort().join(':');
    if (pairs.has(key)) continue;
    pairs.add(key);
    for (const id of [o.reporter_id, o.partner_id]) {
      const row = get(id);
      if (row) row.oneOnOnes++;
    }
  }
  for (const v of input.visitors) {
    const row = get(v.referrer_id);
    if (row) row.visitors++;
  }
  for (const j of input.joined) {
    const row = get(j.referred_by);
    if (row) row.joined++;
  }
  for (const a of input.attendance) {
    const row = get(a.profile_id);
    if (!row) continue;
    if (a.status === 'present' && a.substitute) row.substitutes++;
    else if (a.status === 'present') row.meetings++;
  }
  for (const p of input.presentations) {
    const row = get(p.profile_id);
    if (row) row.presentations++;
  }

  const P = CHAMPION_POINTS;
  for (const row of rows.values()) {
    row.points = row.referrals * P.referral + row.oneOnOnes * P.oneOnOne + row.meetings * P.meeting;
    if (input.meetingsTaken > 0) {
      row.attendanceShare = (row.meetings + row.substitutes) / input.meetingsTaken;
      row.eligible = row.attendanceShare >= CHAMPION_MIN_ATTENDANCE;
    }
  }
  // Highest points first; ties go to more closed business, then more referrals given.
  return [...rows.values()]
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || b.closedAmount - a.closedAmount || b.referrals - a.referrals || a.name.localeCompare(b.name));
}

/** The automatic pick: the top eligible member, or null when nobody scored. */
export const autoChampion = (rows: ChampionRow[]) => rows.find((r) => r.eligible) ?? null;

/** First and last moment of a calendar month in Pacific time, as ISO strings, plus the YYYY-MM-01 key. */
export function monthRange(month: string): { key: string; from: string; to: string; label: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const key = `${y}-${String(m).padStart(2, '0')}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  // Pacific is UTC-7/-8; 08:00 UTC is safely past midnight Pacific on the 1st.
  return {
    key,
    from: `${key}T08:00:00Z`,
    to: `${next}T08:00:00Z`,
    label: new Date(`${key}T12:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

/** "2026-10" for a date, in Pacific time. */
export const monthOf = (d: Date) => d.toLocaleString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Los_Angeles' }).slice(0, 7);

/** The month before "2026-10" → "2026-09". */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
