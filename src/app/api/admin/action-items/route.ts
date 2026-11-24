// The admin notification bell (owner, 2026-11-24): the Overview's "Items that Need Immediate Action". Admins only.
import { NextResponse } from 'next/server';
import { getViewer, isAdmin } from '@/lib/auth';
import { loadActionItems } from '@/lib/data/admin-action-items';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin(await getViewer())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const items = await loadActionItems(await createClient());
  return NextResponse.json(
    { items: items.map(({ key, title, detail, href, tone, tab }) => ({ key, title, detail, href, tone, tab })) },
    { headers: { 'cache-control': 'no-store' } },
  );
}
