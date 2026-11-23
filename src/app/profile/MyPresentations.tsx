import Link from 'next/link';
import { PresenterMaterials } from '@/app/meetings/PresenterMaterials';
import { SpeakerTopicForm } from '@/app/meetings/SpeakerTopicForm';
import { EmptyState } from '@/components/ui';
import { slotTitles } from '@/lib/content';
import { formatMeetingDate, formatMeetingTime } from '@/lib/dates';
import { getPresentationMaterials } from '@/lib/data/presentation-materials';
import { createClient } from '@/lib/supabase/server';

const afterOf = { education: 'five_minute', presentation: 'ten_minute' } as const;

/**
 * My profile → My Presentations (owner, 2026-11-23): the member's upcoming 5- and 10-minute presentations, each with
 * its date, the presentation's name (topic) and where to add their slides (PDF, PowerPoint, image, YouTube video or
 * website), the same as under their slot on the Meetings page.
 */
export async function MyPresentations({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('meeting_speakers')
    .select('slot, topic, topic_description, meeting:meetings!inner(id, title, starts_at, category, cancelled_reason)')
    .eq('profile_id', userId)
    .in('slot', ['education', 'presentation'])
    .gt('meetings.starts_at', new Date().toISOString())
    .is('meetings.cancelled_reason', null);
  if (error) throw new Error('Could not load your presentations');
  const mine = (data ?? [])
    .map((s) => ({ ...s, slot: s.slot as 'education' | 'presentation', meeting: s.meeting as unknown as { id: string; title: string; starts_at: string } }))
    .sort((a, b) => a.meeting.starts_at.localeCompare(b.meeting.starts_at));
  const materials = await getPresentationMaterials(
    supabase,
    mine.map((s) => s.meeting.id),
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="my-pres-h">
      <div>
        <h2 id="my-pres-h" className="font-display m-0 text-2xl font-extrabold">
          My Presentations
        </h2>
        <p className="text-ink-muted m-0 mt-1">
          Your upcoming 5- and 10-minute presentations. Give each one a name, and add your slides: a PDF, PowerPoint, image, YouTube video or website. They show
          in the meeting slides right after your presentation slide. You can add or remove them until the meeting starts. To book a slot, go to the{' '}
          <Link href="/meetings">Meetings page</Link>.
        </p>
      </div>
      {mine.length === 0 ? (
        <EmptyState title="No presentations scheduled">
          Claim an open 5- or 10-minute slot on the <Link href="/meetings">Meetings page</Link>.
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {mine.map((s) => {
            const start = new Date(s.meeting.starts_at);
            const when = formatMeetingDate(start);
            return (
              <li key={`${s.meeting.id}-${s.slot}`} className="card flex flex-wrap gap-3 p-5" aria-label={`${slotTitles[s.slot]} on ${when}`}>
                <div className="basis-full">
                  <p className="text-teal-text m-0 text-sm font-bold tracking-wide uppercase">{slotTitles[s.slot]}</p>
                  <h3 className="font-display m-0 text-xl font-extrabold">
                    {when}, {formatMeetingTime(start)} PT
                  </h3>
                  <p className="text-ink-muted m-0 text-sm">{s.meeting.title}</p>
                </div>
                <SpeakerTopicForm meetingId={s.meeting.id} slot={s.slot} when={when} topic={s.topic} description={s.topic_description} />
                <PresenterMaterials
                  meetingId={s.meeting.id}
                  slot={s.slot}
                  userId={userId}
                  when={when}
                  defaultOpen
                  items={materials
                    .filter((x) => x.meetingId === s.meeting.id && x.afterSlide === afterOf[s.slot])
                    .map((x) => ({
                      id: x.id,
                      kind: x.kind,
                      title: x.title,
                      afterSlide: x.afterSlide,
                      pageCount: x.pageCount,
                      url: x.url,
                      mine: x.createdBy === userId,
                    }))}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
