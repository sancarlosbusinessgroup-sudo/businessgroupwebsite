import type { Metadata } from 'next';
import { CalendarPage, type CalendarSearch } from '@/components/CalendarPage';

export const metadata: Metadata = { title: 'Member events' };

/** Events hosted by members. Group meetings have their own page (/group-meetings). */
export default async function EventsPage({ searchParams }: { searchParams: Promise<CalendarSearch> }) {
  return <CalendarPage kind="member" sp={await searchParams} />;
}
