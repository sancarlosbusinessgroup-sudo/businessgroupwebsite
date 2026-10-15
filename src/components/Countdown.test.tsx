import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from './Countdown';

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('shows days, hours, minutes and seconds and ticks every second', () => {
    render(<Countdown target="2026-10-15T01:02:03Z" />);
    const timer = screen.getByRole('timer', { name: /time until the next meeting/i });
    expect(timer).toHaveTextContent('1Days01Hours02Min03Sec');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(timer).toHaveTextContent('02Sec');
  });

  it('shows a starting message once the meeting begins', () => {
    render(<Countdown target="2026-10-13T00:00:00Z" />);
    expect(screen.getByText(/meeting is starting/i)).toBeInTheDocument();
  });
});
