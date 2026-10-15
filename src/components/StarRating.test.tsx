import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('is a labelled radio group that can be used with the keyboard', async () => {
    const user = userEvent.setup();
    render(
      <form>
        <StarRating name="rating" legend="How was the one-on-one?" />
      </form>,
    );
    const group = screen.getByRole('radiogroup', { name: /how was the one-on-one/i });
    expect(group).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '4 stars' }));
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '5 stars' })).toBeChecked();
  });
});
