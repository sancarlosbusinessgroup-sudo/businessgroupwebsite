import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileMeetingBar } from './MobileMeetingBar';

const push = vi.fn();
const openLiveChat = vi.fn(async () => true);

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push }) }));
vi.mock('@/lib/chat-client', () => ({ openLiveChat: () => openLiveChat() }));
vi.mock('@/app/actions/member', () => ({ joinMeeting: vi.fn() }));

const when = 'Monday, Nov 2 · 8:15 AM PT';

beforeEach(() => {
  push.mockClear();
  openLiveChat.mockClear();
});

describe('MobileMeetingBar', () => {
  it('visitors: the chat button sits beside "Log In" when live chat is on', () => {
    render(<MobileMeetingBar meetingId="m-1" when={when} member={false} chatEnabled />);
    const login = screen.getByRole('link', { name: 'Log In' });
    const chat = screen.getByRole('button', { name: 'Chat with support' });
    expect(login.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(chat);
    expect(openLiveChat).toHaveBeenCalledOnce();
  });

  it('members: the chat button sits to the right of "One-on-ones" in the second row', () => {
    render(<MobileMeetingBar meetingId="m-1" when={when} member chatEnabled />);
    const oneOnOnes = screen.getByRole('link', { name: 'One-on-ones' });
    const chat = screen.getByRole('button', { name: 'Chat with support' });
    expect(oneOnOnes.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join in Zoom' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log In' })).toBeNull();
  });

  it('leaves out the chat button while live chat is switched off', () => {
    render(<MobileMeetingBar meetingId="m-1" when={when} member={false} chatEnabled={false} />);
    expect(screen.queryByRole('button', { name: 'Chat with support' })).toBeNull();
  });

  it('sends the visitor to the support page when the chat cannot load', async () => {
    openLiveChat.mockResolvedValueOnce(false);
    render(<MobileMeetingBar meetingId="m-1" when={when} member={false} chatEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat with support' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/support'));
  });

  it('shows "Date to be announced" and the chat button when no meeting is scheduled', () => {
    render(<MobileMeetingBar meetingId={null} when={null} member={false} chatEnabled />);
    expect(screen.getByText('Date to be announced')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat with support' })).toBeInTheDocument();
  });
});
