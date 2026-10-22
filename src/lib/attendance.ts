type Status = 'present' | 'excused' | 'absent';
type Meeting = { id: string; starts_at: string };
type Row = { meeting_id: string; status: Status; checked_in_at: string | null; method: string };

/** Past meetings (newest first) joined with attendance records; missing records count as absent. */
export function attendanceHistory<M extends Meeting>(pastMeetings: M[], rows: Row[]) {
  const byMeeting = new Map(rows.map((r) => [r.meeting_id, r]));
  const items = [...pastMeetings]
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .map((m) => {
      const r = byMeeting.get(m.id);
      return { meeting: m, status: (r?.status ?? 'absent') as Status, checkedInAt: r?.checked_in_at ?? null, method: r?.method ?? null };
    });
  let streak = 0;
  for (const i of items) {
    if (i.status === 'present') streak++;
    else if (i.status === 'excused') continue;
    else break;
  }
  return { items, streak, present: items.filter((i) => i.status === 'present').length, held: items.length };
}
