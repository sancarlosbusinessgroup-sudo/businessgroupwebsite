import { PASSWORD, STACK, serviceKey, users } from './support';

/** Creates (or resets) the fixed test accounts in the local stack. */
export default async function globalSetup() {
  const key = await serviceKey();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  const list = await fetch(`${STACK}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!list.ok) throw new Error('Local stack is not running. Start it with: npm run stack:start');
  const existing = ((await list.json()) as { users: { id: string; email: string }[] }).users;
  for (const u of existing) {
    if (u.email.endsWith('@example.test')) await fetch(`${STACK}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers });
  }

  const make = async (email: string, first: string, last: string, business: string, status: string, role = 'member') => {
    const res = await fetch(`${STACK}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: first, last_name: last, business_name: business, guest_meetings_attended: '2', agreed_commitments: 'true' },
      }),
    });
    if (!res.ok) throw new Error(`create ${email}: ${await res.text()}`);
    const { id } = (await res.json()) as { id: string };
    const upd = await fetch(`${STACK}/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status, role }) });
    if (!upd.ok) throw new Error(`profile ${email}: ${await upd.text()}`);
    return id;
  };

  await make(users.admin, 'Ada', 'Admin', 'Test Admin Co', 'approved', 'admin');
  await make(users.member, 'Morgan', 'Member', 'Test Member Studio', 'approved');
  await make(users.member2, 'Riley', 'Second', 'Second Test Bakery', 'approved');
  await make(users.pending, 'Pat', 'Pending', 'Pending Test Shop', 'pending');
  await fetch('http://127.0.0.1:54326/messages', { method: 'DELETE' });
}
