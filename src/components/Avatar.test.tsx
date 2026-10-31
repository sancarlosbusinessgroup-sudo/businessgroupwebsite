import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './ui';

// Owner, 2026-10-30: the round person icons show the member's profile photo; initials only when there is none.
describe('Avatar', () => {
  it('shows the profile photo when there is one', () => {
    const { container } = render(<Avatar name="Cedrick Velasco" size={38} photo="/members/barastone.webp" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('barastone');
    expect(container.textContent).not.toContain('CV');
  });
  it('falls back to initials without a photo', () => {
    const { container } = render(<Avatar name="Cedrick Velasco" size={38} photo={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('CV');
  });
});
