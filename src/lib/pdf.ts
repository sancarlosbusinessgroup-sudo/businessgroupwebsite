import 'server-only';

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

// Simple printable PDFs (owner, 2026-11-24): the "No 60-second infomercial" list and member report cards.
// Letter size, Helvetica, the group's teal for headings. Text the standard fonts can't draw is replaced, never dropped.

export type PdfBlock =
  | { kind: 'title'; text: string }
  | { kind: 'subtitle'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'row'; label: string; value: string }
  | { kind: 'space' }
  | { kind: 'pagebreak' };

const TEAL = rgb(0.047, 0.482, 0.455); // #0c7b74
const INK = rgb(0.13, 0.15, 0.17);
const MUTED = rgb(0.38, 0.42, 0.45);
const PAGE = { w: 612, h: 792, margin: 54 };

/** Characters Helvetica (WinAnsi) can draw; anything else becomes a close ASCII stand-in or "?". */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‐-‒]/g, '-')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7e¡-ÿ–—‘’“”•…€]/g, '?');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of pdfSafe(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function buildPdf(blocks: PdfBlock[], meta: { title: string; footer?: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(meta.title));
  doc.setCreator('Bay Area Referral Partners');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = PAGE.w - PAGE.margin * 2;
  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - PAGE.margin;

  const newPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - PAGE.margin;
  };
  const draw = (lines: string[], font: PDFFont, size: number, color = INK, indent = 0, gap = 4) => {
    for (const l of lines) {
      if (y - size < PAGE.margin + 20) newPage();
      y -= size;
      page.drawText(l, { x: PAGE.margin + indent, y, size, font, color });
      y -= gap;
    }
  };

  for (const b of blocks) {
    switch (b.kind) {
      case 'title':
        draw(wrap(b.text, bold, 20, width), bold, 20, TEAL, 0, 6);
        break;
      case 'subtitle':
        draw(wrap(b.text, regular, 11, width), regular, 11, MUTED);
        y -= 6;
        break;
      case 'heading':
        y -= 8;
        draw(wrap(b.text, bold, 13, width), bold, 13, TEAL);
        break;
      case 'text':
        draw(wrap(b.text, regular, 11, width), regular, 11);
        break;
      case 'bullet': {
        const lines = wrap(b.text, regular, 11, width - 14);
        if (y - 11 < PAGE.margin + 20) newPage();
        page.drawText('•', { x: PAGE.margin + 2, y: y - 11, size: 11, font: regular, color: TEAL });
        draw(lines, regular, 11, INK, 14);
        break;
      }
      case 'row': {
        const labelW = 230;
        const lines = wrap(b.value, regular, 11, width - labelW);
        if (y - 11 < PAGE.margin + 20) newPage();
        page.drawText(pdfSafe(b.label), { x: PAGE.margin, y: y - 11, size: 11, font: bold, color: INK });
        draw(lines, regular, 11, INK, labelW);
        break;
      }
      case 'space':
        y -= 10;
        break;
      case 'pagebreak':
        newPage();
        break;
    }
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const text = pdfSafe(`${meta.footer ?? 'Bay Area Referral Partners'} · Page ${i + 1} of ${pages.length}`);
    p.drawText(text, { x: PAGE.margin, y: PAGE.margin - 24, size: 9, font: regular, color: MUTED });
  });
  return doc.save();
}

/** A PDF download response. */
export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]+/g, '-')}"`,
      'cache-control': 'no-store',
    },
  });
}
