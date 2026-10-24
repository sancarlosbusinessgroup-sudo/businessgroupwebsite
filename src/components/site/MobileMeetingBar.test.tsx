import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileMeetingBar } from './MobileMeetingBar';

const push = vi.fn();
const openLiveChat = vi.fn(async () => true);

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push }) }));
vi.mock('@/lib/chat-client', () => ({ openLiveChat: () => openLiveChat() }));
vi.mock('@/app/actions/member', () => ({ joinMeeting: vi.fn() }));

const base = { meetingId: 'm-1', when: 'Monday, Nov 2 · 8:15 AM PT', member: false };

beforeEach(() => {
  push.mockClear();
  openLiveChat.mockClear();
});

describe('MobileMeetingBar', () => {
  it('shows the round chat button to the right of the visitor action when live chat is on', () => {
    render(<MobileMeetingBar {...base} chatEnabled />);
    const request = screen.getByRole('link', { name: 'Request an invite' });
    const chat = screen.getByRole('button', { name: 'Chat with support' });
    // Same row, chat button after the action.
    expect(request.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(chat);
    expect(openLiveChat).toHaveBeenCalledOnce();
  });

  it('leaves out the chat button while live chat is switched off', () => {
    render(<MobileMeetingBar {...base} chatEnabled={false} />);
    expect(screen.queryByRole('button', { name: 'Chat with support' })).toBeNull();
  });

  it('sends the visitor to the support page when the chat cannot load', async () => {
    openLiveChat.mockResolvedValueOnce(false);
    render(<MobileMeetingBar {...base} chatEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat with support' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/support'));
  });

  it('shows "Date to be announced" and the chat button when no meeting is scheduled', () => {
    render(<MobileMeetingBar meetingId={null} when={null} member={false} chatEnabled />);
    expect(screen.getByText('Date to be announced')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat with support' })).toBeInTheDocument();
  });
});
