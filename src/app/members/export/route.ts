import { NextResponse, type NextRequest } from 'next/server';
import { getViewer, isApproved } from '@/lib/auth';
import { localDateKey } from '@/lib/dates';
import { toCsv, toVcards } from '@/lib/exports';
import { createClient } from '@/lib/supabase/server';

// Members-only directory download (Excel-ready CSV or vCard). Every download is logged for admins.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format') === 'vcf' ? 'vcf' : 'csv';
  const viewer = await getViewer();
  if (!isApproved(viewer)) return NextResponse.redirect(new URL('/login?next=/members', req.url));

  const supabase = await createClient();
  const [profilesRes, contactsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, business_name, website, city, categories(name)')
      .eq('status', 'approved')
      .eq('show_in_directory', true)
      .order('business_name'),
    supabase.from('member_contacts').select('profile_id, email, phone'),
  ]);
  if (profilesRes.error || contactsRes.error) return new NextResponse('Could not build the download. Please try again.', { status: 500 });

  const log = await supabase.from('directory_downloads').insert({ format });
  if (log.error) return new NextResponse('Could not build the download. Please try again.', { status: 500 });

  const contacts = new Map(contactsRes.data.map((c) => [c.profile_id, c]));
  const rows = profilesRes.data.map((p) => ({ ...p, contact: contacts.get(p.id) }));
  const stamp = localDateKey(new Date());

  if (format === 'vcf') {
    const body = toVcards(
      rows.map((r) => ({
        firstName: r.first_name,
        lastName: r.last_name,
        business: r.business_name,
        category: r.categories?.name ?? null,
        email: r.contact?.email ?? null,
        phone: r.contact?.phone ?? null,
        website: r.website,
      })),
    );
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': `attachment; filename="member-contacts-${stamp}.vcf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const body = toCsv(
    ['First name', 'Last name', 'Business', 'Category', 'Email', 'Phone', 'Website', 'City'],
    rows.map((r) => [r.first_name, r.last_name, r.business_name, r.categories?.name, r.contact?.email, r.contact?.phone, r.website, r.city]),
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="member-directory-${stamp}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
