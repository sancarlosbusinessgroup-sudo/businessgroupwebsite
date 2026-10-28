import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { isLeakedPassword } from './leaked-passwords';

// SHA-1 of "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8 → prefix 5BAA6, suffix 1E4C9B93F3F0682250B6CF8331B7EE68FD8
const fakeFetch = (body: string, ok = true) => (async () => ({ ok, text: async () => body })) as unknown as typeof fetch;

describe('isLeakedPassword', () => {
  it('flags a password whose hash suffix is in the range response', async () => {
    const leaked = await isLeakedPassword('password', fakeFetch('0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\n'));
    expect(leaked).toBe(true);
  });
  it('passes a password that is not listed, or listed with a zero (padding) count', async () => {
    expect(await isLeakedPassword('password', fakeFetch('0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n'))).toBe(false);
    expect(await isLeakedPassword('password', fakeFetch('1E4C9B93F3F0682250B6CF8331B7EE68FD8:0\r\n'))).toBe(false);
  });
  it('never blocks when the service is unavailable', async () => {
    expect(await isLeakedPassword('password', fakeFetch('', false))).toBe(false);
    expect(
      await isLeakedPassword('password', (async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch),
    ).toBe(false);
  });
});
