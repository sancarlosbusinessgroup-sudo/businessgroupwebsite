/** Turns a Supabase password-change error into a message a member can act on. */
export function passwordErrorMessage(error: { code?: string; message?: string }, fallback: string): string {
  switch (error.code) {
    case 'same_password':
      return 'That is already your password. Please choose a new one.';
    case 'weak_password':
      return 'That password is too easy to guess (it may have appeared in a data breach). Please choose a different one.';
    default:
      return fallback;
  }
}
