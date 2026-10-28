import type { Metadata } from 'next';
import { CalendarPage, type CalendarSearch } from '@/components/CalendarPage';

export const metadata: Metadata = {
  title: 'Member events',
  description: 'Mixers, workshops and community events hosted by our members, plus our regular Monday meetings.',
};

/** Events hosted by members. Group meetings have their own page (/group-meetings). */
export default async function EventsPage({ searchParams }: { searchParams: Promise<CalendarSearch> }) {
  return <CalendarPage kind="member" sp={await searchParams} />;
}
