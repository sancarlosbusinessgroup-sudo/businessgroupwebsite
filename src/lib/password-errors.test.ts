import { describe, expect, it } from 'vitest';
import { passwordErrorMessage } from './password-errors';

describe('passwordErrorMessage', () => {
  const fallback = 'We could not update your password. Please try a different one.';

  it('explains when the new password is the same as the current one', () => {
    expect(passwordErrorMessage({ code: 'same_password', message: 'New password should be different from the old password.' }, fallback)).toBe(
      'That is already your password. Please choose a new one.',
    );
  });

  it('explains when the password is too weak or known from a data breach', () => {
    expect(passwordErrorMessage({ code: 'weak_password', message: 'Password is known to be weak and easy to guess' }, fallback)).toBe(
      'That password is too easy to guess (it may have appeared in a data breach). Please choose a different one.',
    );
  });

  it('falls back to the general message for anything else', () => {
    expect(passwordErrorMessage({ code: 'unexpected_failure', message: 'boom' }, fallback)).toBe(fallback);
    expect(passwordErrorMessage({ message: 'no code' }, fallback)).toBe(fallback);
  });
});
