// Member report cards as a PDF: one member (?m=) or everyone, for a quarter (?q=2026-Q4). Admins only (owner, 2026-11-24).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getViewer, isAdmin } from '@/lib/auth';
import { loadReportCards } from '@/lib/data/report-cards';
import { formatMeetingDate } from '@/lib/dates';
import { buildPdf, pdfResponse, type PdfBlock } from '@/lib/pdf';
import { goalsSummary, quarterOf, quarterRange, reportCardLines } from '@/lib/report-card';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin(await getViewer())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const range = quarterRange(sp.get('q') ?? quarterOf(new Date()));
  if (!range) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const memberId = sp.get('m');
  if (memberId && !z.uuid().safeParse(memberId).success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const { members, goals } = await loadReportCards(range);
  const chosen = memberId ? members.filter((m) => m.id === memberId) : members;
  if (!chosen.length) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const blocks: PdfBlock[] = [];
  chosen.forEach((m, n) => {
    if (n) blocks.push({ kind: 'pagebreak' });
    const lines = reportCardLines(m.card, goals);
    const sum = goalsSummary(lines);
    blocks.push(
      { kind: 'title', text: `Report card: ${m.name}` },
      { kind: 'subtitle', text: `${m.business ? `${m.business} · ` : ''}${range.label} · printed ${formatMeetingDate(new Date())}` },
      { kind: 'heading', text: sum ? `${sum.met} of ${sum.total} goals met` : 'This quarter' },
    );
    for (const l of lines)
      blocks.push({
        kind: 'row',
        label: l.label,
        value: `${l.value}${l.goal ? `   (goal ${l.goal}${l.met === null ? '' : l.met ? ', met' : ', not yet'})` : ''}`,
      });
    blocks.push(
      { kind: 'heading', text: 'Notes from our conversation' },
      { kind: 'text', text: '_______________________________________________________________________________' },
      { kind: 'space' },
      { kind: 'text', text: '_______________________________________________________________________________' },
      { kind: 'space' },
      { kind: 'text', text: '_______________________________________________________________________________' },
    );
  });
  const bytes = await buildPdf(blocks, { title: `Report cards ${range.label}`, footer: `Bay Area Referral Partners · Report card · ${range.label}` });
  const who = chosen.length === 1 ? chosen[0]!.name : 'all-members';
  return pdfResponse(bytes, `report-card-${range.key}-${who}.pdf`);
}
