import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SupportChatButton } from './SupportChatButton';

type TidioWindow = Window & { tidioChatApi?: Record<string, unknown> };
// Tidio reports 'online'/'offline' once the chat has loaded (null before).
const loadedTidio = (open: () => void) => ({ open, getStatus: () => 'online' });

beforeAll(() => {
  // jsdom has no modal dialogs; a minimal stand-in is enough to check which window opens.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
});

afterEach(() => {
  delete (window as TidioWindow).tidioChatApi;
  vi.useRealTimers();
});

describe('SupportChatButton', () => {
  it('shows the coming-soon window while live chat is switched off', () => {
    render(<SupportChatButton chatEnabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat with support' }));
    expect(screen.getByRole('dialog', { name: 'Live chat is coming soon' })).toBeInTheDocument();
  });

  it('opens the Tidio chat window when live chat is on and loaded', async () => {
    const open = vi.fn();
    (window as TidioWindow).tidioChatApi = loadedTidio(open);
    render(<SupportChatButton chatEnabled />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Chat with support' }));
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for the chat to finish loading, then opens it', async () => {
    vi.useFakeTimers();
    const open = vi.fn();
    render(<SupportChatButton chatEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat with support' }));
    (window as TidioWindow).tidioChatApi = { open, getStatus: () => null };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(open).not.toHaveBeenCalled();
    (window as TidioWindow).tidioChatApi = loadedTidio(open);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains what to do when the chat cannot load (for example an ad blocker)', async () => {
    vi.useFakeTimers();
    render(<SupportChatButton chatEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat with support' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    const dialog = screen.getByRole('dialog', { name: 'The chat window didn’t open' });
    expect(dialog).toHaveTextContent(/ad blocker/i);
  });
});
