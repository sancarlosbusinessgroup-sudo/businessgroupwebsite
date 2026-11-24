// "No 60-second infomercial" list as a PDF, for whoever runs the slides (owner, 2026-11-24). Admins only.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getViewer, isAdmin } from '@/lib/auth';
import { loadNoInfomercialList } from '@/lib/data/no-infomercial';
import { formatMeetingDate, formatMeetingTime, localDateKey } from '@/lib/dates';
import { buildPdf, pdfResponse, type PdfBlock } from '@/lib/pdf';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin(await getViewer())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const raw = new URL(request.url).searchParams.get('meeting');
  const id = raw ? z.uuid().safeParse(raw) : null;
  if (id && !id.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const list = await loadNoInfomercialList(await createClient(), id?.data ?? null);
  if (!list.meeting) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const when = formatMeetingDate(new Date(list.meeting.starts_at));
  const blocks: PdfBlock[] = [
    { kind: 'title', text: `No 60-second infomercial on ${when}` },
    {
      kind: 'subtitle',
      text: list.previous
        ? `Members who left the ${formatMeetingDate(new Date(list.previous.starts_at))} meeting before the end. Bylaws: "If you leave before the 9:45 AM finish, you will not be permitted to do your 60-second infomercial at the next meeting." Members excused for an emergency are not listed.`
        : 'There is no earlier meeting to go by.',
    },
  ];
  if (list.previous && !list.taken) blocks.push({ kind: 'text', text: 'Attendance for that meeting has not been taken yet, so this list may be incomplete.' });
  if (list.previous) {
    blocks.push({ kind: 'heading', text: list.people.length ? `${list.people.length} ${list.people.length === 1 ? 'member' : 'members'}` : 'Nobody' });
    if (!list.people.length) blocks.push({ kind: 'text', text: 'Everyone may do their infomercial.' });
    for (const p of list.people)
      blocks.push({
        kind: 'bullet',
        text: `${p.name}${p.business ? ` (${p.business})` : ''}${p.how === 'admin' ? ' - marked by an admin' : p.leftAt ? ` - left at ${formatMeetingTime(new Date(p.leftAt))}` : ''}`,
      });
  }
  blocks.push({ kind: 'space' }, { kind: 'text', text: `Printed ${formatMeetingDate(new Date())} at ${formatMeetingTime(new Date())} PT.` });
  const bytes = await buildPdf(blocks, { title: `No infomercial ${when}` });
  return pdfResponse(bytes, `no-infomercial-${localDateKey(new Date(list.meeting.starts_at))}.pdf`);
}
