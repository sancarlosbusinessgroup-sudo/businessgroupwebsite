import Link from 'next/link';
import type { ReactNode } from 'react';
import { agreementTerms } from '@/lib/content';
import { bylaws, procedures } from '@/lib/governance';

// The group's rules, taken from the Bylaws and Procedures (src/lib/governance.ts) so the wording stays in one place.
// Used by Support → Rules (members) and the box at the top of Admin → Attendance (owner, 2026-11-24).

const tardiness = procedures.definitions.find((d) => d.term === 'Tardiness')?.text ?? '';

/** Absences and tardiness, as in the Bylaws and Procedures. */
export const attendanceRules = {
  absences: [...procedures.absences, bylaws.release[1]!].filter((x, i, all) => all.indexOf(x) === i),
  tardiness: [...procedures.attendance.slice(1), tardiness],
};

const Bullets = ({ items }: { items: readonly string[] }) => (
  <ul className="m-0 flex flex-col gap-1.5 pl-5">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

/** The box at the top of Admin → Attendance: the rules about absences and tardiness. */
export function AttendanceRulesBox() {
  return (
    <section aria-labelledby="att-rules-h" className="border-teal bg-teal-tint flex flex-col gap-3 rounded-2xl border p-5 text-[15px]">
      <h2 id="att-rules-h" className="font-display text-heading m-0 text-lg font-extrabold">
        Attendance rules (Bylaws &amp; Procedures)
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-heading m-0 text-base font-bold">Absences</h3>
          <Bullets items={attendanceRules.absences} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-heading m-0 text-base font-bold">Tardiness and leaving early</h3>
          <Bullets items={attendanceRules.tardiness} />
        </div>
      </div>
      <p className="m-0 text-sm">
        Full text: <Link href="/bylaws#procedures">Bylaws &amp; Procedures</Link>.
      </p>
    </section>
  );
}

function Rule({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="card flex scroll-mt-24 flex-col gap-3 p-6">
      <h2 id={`${id}-h`} className="font-display text-heading m-0 text-xl font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Support → Rules: every rule members agree to, grouped, from the Bylaws and Procedures. */
export function RulesSections() {
  const dues = agreementTerms.find((t) => t.title === 'Dues')?.text ?? procedures.dues;
  return (
    <div className="flex flex-col gap-6 text-[17px] leading-relaxed">
      <Rule id="attendance" title="Attendance and absences">
        <Bullets items={[procedures.attendance[0]!, ...attendanceRules.absences]} />
      </Rule>
      <Rule id="tardiness" title="Arriving late and leaving early">
        <Bullets items={attendanceRules.tardiness} />
      </Rule>
      <Rule id="expectations" title="What every member does">
        <Bullets items={procedures.weekly} />
        <p className="m-0">{procedures.annualReview}</p>
      </Rule>
      <Rule id="meetings" title="At meetings">
        <Bullets items={[bylaws.meetings, ...procedures.etiquette]} />
      </Rule>
      <Rule id="presentations" title="Presentations">
        <Bullets items={procedures.presentation} />
      </Rule>
      <Rule id="membership" title="Joining and staying a member">
        <p className="m-0">{bylaws.acceptanceIntro}</p>
        <Bullets items={bylaws.acceptance} />
        <p className="m-0">{bylaws.releaseIntro}</p>
        <Bullets items={bylaws.release} />
      </Rule>
      <Rule id="dues" title="Dues">
        <p className="m-0">{dues}</p>
      </Rule>
    </div>
  );
}
