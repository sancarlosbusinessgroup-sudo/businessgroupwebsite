import type { Metadata } from 'next';
import { CalendarPage, type CalendarSearch } from '@/components/CalendarPage';

export const metadata: Metadata = { title: 'Meeting Schedules' };

/** The group's own meetings and gatherings. Member-hosted events are on /events. */
export default async function GroupMeetingsPage({ searchParams }: { searchParams: Promise<CalendarSearch> }) {
  return <CalendarPage kind="group" sp={await searchParams} />;
}
