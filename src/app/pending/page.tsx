import { redirect } from 'next/navigation';

// Applicants no longer log in to check their status: only approved members can log in (owner, 2026-10-24).
// Old links (and the confirmation emails already sent) land on the login page instead.
export default function PendingPage() {
  redirect('/login');
}
