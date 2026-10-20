// Thin Brevo client (transactional email + contacts). Server-only: uses BREVO_API_KEY.
// Without a key it does nothing and reports "skipped", so local dev and previews never send mail.
import 'server-only';

export const SENDER = { email: 'hello@notify.bayareareferralpartners.com', name: 'Bay Area Referral Partners' } as const;

const apiUrl = () => (process.env.BREVO_API_URL || 'https://api.brevo.com/v3').replace(/\/$/, '');

export type SendResult = { status: 'sent' | 'skipped' | 'failed'; error?: string };

async function call(path: string, method: string, body?: unknown): Promise<Response | null> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return null;
  return fetch(`${apiUrl()}${path}`, {
    method,
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
}

export async function sendEmail(m: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  tag: string;
  replyTo?: { email: string; name?: string };
}): Promise<SendResult> {
  try {
    const res = await call('/smtp/email', 'POST', {
      sender: SENDER,
      to: [m.to.name ? m.to : { email: m.to.email }],
      subject: m.subject,
      htmlContent: m.html,
      textContent: m.text,
      tags: [m.tag],
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    });
    if (!res) return { status: 'skipped', error: 'BREVO_API_KEY not set' };
    if (!res.ok) return { status: 'failed', error: `Brevo ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'send failed' };
  }
}

const listId = () => {
  const n = Number(process.env.BREVO_LIST_ID);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Add or update a member in the Brevo "Members" newsletter list. */
export async function upsertContact(c: { email: string; firstName: string; lastName: string; business?: string | null }): Promise<SendResult> {
  const id = listId();
  if (!id) return { status: 'skipped', error: 'BREVO_LIST_ID not set' };
  try {
    const res = await call('/contacts', 'POST', {
      email: c.email,
      attributes: { FIRSTNAME: c.firstName, LASTNAME: c.lastName, ...(c.business ? { COMPANY: c.business } : {}) },
      listIds: [id],
      updateEnabled: true,
    });
    if (!res) return { status: 'skipped', error: 'BREVO_API_KEY not set' };
    if (!res.ok && res.status !== 204) return { status: 'failed', error: `Brevo ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'contact sync failed' };
  }
}

/** Take a former member off the newsletter list (the contact itself stays in Brevo). */
export async function removeFromList(email: string): Promise<SendResult> {
  const id = listId();
  if (!id) return { status: 'skipped', error: 'BREVO_LIST_ID not set' };
  try {
    const res = await call(`/contacts/lists/${id}/contacts/remove`, 'POST', { emails: [email] });
    if (!res) return { status: 'skipped', error: 'BREVO_API_KEY not set' };
    // 400 "contact already removed / not in list" is fine.
    if (!res.ok && res.status !== 400) return { status: 'failed', error: `Brevo ${res.status}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'remove failed' };
  }
}
