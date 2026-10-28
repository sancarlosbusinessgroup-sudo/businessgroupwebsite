// Only approved members can log in (owner, 2026-10-24). Shared by the proxy, the login action and the email links.

export type LoginNotice = 'confirmed' | 'pending' | 'inactive';

/** Which explanation a signed-out, not-approved account sees on the login page. */
export const noticeFor = (status: string | null | undefined): LoginNotice => (status === 'declined' || status === 'inactive' ? 'inactive' : 'pending');

export const loginNotices: Record<LoginNotice, string> = {
  confirmed: 'Your email is confirmed. You can log in once the Membership Committee approves your membership. We’ll email you when you’re approved.',
  pending: 'Your application is still waiting for approval. You can log in once the Membership Committee approves your membership.',
  inactive: 'Your membership is not active. Please contact the Membership Committee if you have questions.',
};

export const isLoginNotice = (v: unknown): v is LoginNotice => v === 'confirmed' || v === 'pending' || v === 'inactive';
