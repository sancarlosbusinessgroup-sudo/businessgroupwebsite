// Optional email notifications a member can switch off (shared by the server and the profile form).
export const prefKeys = ['referrals', 'one_on_ones', 'meeting_reminders', 'meeting_recaps', 'visitors', 'digest'] as const;
export type PrefKey = (typeof prefKeys)[number];

export const prefLabels: Record<PrefKey, string> = {
  referrals: 'Referrals: when someone sends me a referral or updates one I gave',
  one_on_ones: 'One-on-ones: requests, answers and confirmations',
  meeting_reminders: 'Meeting-day reminder with the Zoom link',
  meeting_recaps: 'Meeting recap after each meeting: slides, presenters, member events and who’s up next',
  visitors: 'My guests: when a guest asks to visit, and a follow-up nudge after they come',
  digest: 'Weekly admin digest',
};

/** Missing key = on. */
export function prefOn(prefs: unknown, key: PrefKey): boolean {
  return !(prefs && typeof prefs === 'object' && (prefs as Record<string, unknown>)[key] === false);
}
