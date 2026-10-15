import { describe, expect, it } from 'vitest';
import { checkImageFile } from './images';

const file = (type: string, size: number) => new File([new Uint8Array(size)], 'x', { type });

describe('checkImageFile', () => {
  it('accepts common photo types under 25 MB', () => {
    expect(checkImageFile(file('image/jpeg', 1000))).toBeNull();
    expect(checkImageFile(file('image/png', 1000))).toBeNull();
  });
  it('rejects empty, non-image and oversized files', () => {
    expect(checkImageFile(null)).toMatch(/choose/i);
    expect(checkImageFile(file('application/pdf', 1000))).toMatch(/not a supported image/i);
    expect(checkImageFile(file('image/gif', 1000))).toMatch(/not a supported image/i);
    expect(checkImageFile(file('image/jpeg', 26 * 1024 * 1024))).toMatch(/25 MB/);
  });
});
