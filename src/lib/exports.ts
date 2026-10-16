// Directory and stats downloads. Pure functions so they can be unit-tested.

type Cell = string | number | null | undefined;

function csvCell(v: Cell): string {
  let s = v === null || v === undefined ? '' : String(v);
  // Stop spreadsheet apps from treating text as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a UTF-8 BOM (so Excel shows accents correctly) and CRLF line endings. */
export function toCsv(header: string[], rows: Cell[][]): string {
  return '\uFEFF' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export type VcardMember = {
  firstName: string;
  lastName: string;
  business: string;
  category: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
};

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

/** vCard 3.0, one card per member (imports into phone and email contacts). */
export function toVcards(members: VcardMember[]): string {
  return members
    .map((m) => {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${esc(m.lastName)};${esc(m.firstName)};;;`,
        `FN:${esc(`${m.firstName} ${m.lastName}`)}`,
        `ORG:${esc(m.business)}`,
      ];
      if (m.category) lines.push(`TITLE:${esc(m.category)}`);
      if (m.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(m.email)}`);
      if (m.phone) lines.push(`TEL;TYPE=WORK,VOICE:${esc(m.phone)}`);
      if (m.website) lines.push(`URL:${m.website.replace(/[\r\n]/g, '')}`);
      lines.push('END:VCARD');
      return lines.join('\r\n') + '\r\n';
    })
    .join('');
}
