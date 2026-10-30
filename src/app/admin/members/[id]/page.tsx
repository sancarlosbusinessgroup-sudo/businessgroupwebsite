import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { HowThisWorks } from '@/components/HowThisWorks';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { EmptyState, Notice, Pill } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { getCategories } from '@/lib/data/public';
import { formatShortDate, localDateKey } from '@/lib/dates';
import { mediaUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import {
  adminDeleteGalleryPhoto,
  adminDeleteOneOnOne,
  adminDeleteOneOnOneRequest,
  adminDeleteReferral,
  adminRemoveMedia,
  adminSetOneOnOneRequest,
} from '../../../actions/admin-edit';
import { deleteMemberEvent } from '../../../actions/events';
import { AdminProfileForm, OneOnOneEditForm, ReferralEditForm, RoleForm } from './MemberForms';

export const metadata: Metadata = { title: 'Edit member' };

const name = (p: { first_name: string; last_name: string } | null | undefined) => (p ? `${p.first_name} ${p.last_name}` : 'Former member');
const when = (iso: string) => formatShortDate(new Date(iso));
const day = (d: string) => formatShortDate(new Date(`${d}T12:00:00Z`));

/** Admin → Members → one member: edit everything on their profile and everything they posted (owner, 2026-10-27). */
export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const [pRes, contactRes, categories, refRes, ooRes, reqRes, evRes, photoRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('member_contacts').select('email, phone').eq('profile_id', id).maybeSingle(),
    getCategories(),
    supabase
      .from('referrals')
      .select(
        'id, from_id, to_id, contact_name, status, amount, notes, created_at, closed_at, from:profiles!referrals_from_id_fkey(first_name, last_name), to:profiles!referrals_to_id_fkey(first_name, last_name)',
      )
      .or(`from_id.eq.${id},to_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('one_on_ones')
      .select(
        'id, met_on, confirmed_at, reporter_id, partner_id, reporter:profiles!one_on_ones_reporter_id_fkey(first_name, last_name), partner:profiles!one_on_ones_partner_id_fkey(first_name, last_name)',
      )
      .or(`reporter_id.eq.${id},partner_id.eq.${id}`)
      .order('met_on', { ascending: false })
      .limit(50),
    supabase
      .from('one_on_one_requests')
      .select(
        'id, status, proposed_on, created_at, requester_id, invitee_id, requester:profiles!one_on_one_requests_requester_id_fkey(first_name, last_name), invitee:profiles!one_on_one_requests_invitee_id_fkey(first_name, last_name)',
      )
      .or(`requester_id.eq.${id},invitee_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('member_events').select('id, slug, title, starts_at').eq('host_id', id).order('starts_at', { ascending: false }).limit(30),
    supabase
      .from('gallery_photos')
      .select('id, caption, album, thumb_path, created_at')
      .eq('uploaded_by', id)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);
  const p = pRes.data;
  if (!p) notFound();
  const contact = contactRes.data;
  const avatar = mediaUrl('profile-media', p.avatar_path);
  const logo = mediaUrl('profile-media', p.logo_path);
  const isSelf = viewer.userId === p.id;

  return (
    <div className="bg-canvas">
      <div className="container-site flex flex-col gap-6 pt-8 pb-16">
        <div>
          <Link href="/admin/members" className="text-sm font-bold">
            ← All members
          </Link>
          <h1 className="font-display m-0 mt-3 flex flex-wrap items-center gap-3 text-[clamp(28px,3.4vw,40px)] font-extrabold">
            {name(p)}
            {p.role === 'admin' ? <Pill tone="teal">{p.is_owner ? 'Owner' : 'Admin'}</Pill> : null}
          </h1>
          <p className="text-ink-muted m-0 mt-1">
            {p.business_name} · {contact?.email ?? 'no email on file'} · member since {p.member_since ? day(p.member_since) : '—'} ·{' '}
            {p.status === 'approved' ? <Link href={`/members/${p.slug}`}>public profile</Link> : <span>not listed ({p.status})</span>}
          </p>
        </div>
        <HowThisWorks tab="/admin/members" />
        <AdminNav current="/admin/members" />
        {isSelf ? <Notice tone="info">This is your own profile. Changes you make here are not written to the change history.</Notice> : null}

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-5">
            <AdminProfileForm
              id={p.id}
              status={p.status}
              categories={categories}
              defaults={{
                firstName: p.first_name,
                lastName: p.last_name,
                businessName: p.business_name,
                categoryId: p.category_id ? String(p.category_id) : '',
                website: p.website ?? '',
                phone: contact?.phone ?? '',
                city: p.city ?? '',
                serviceArea: p.service_area ?? '',
                about: p.about ?? '',
                idealClient: p.ideal_client ?? '',
                listenFor: p.listen_for ?? '',
                services: p.services.join(', '),
                showInDirectory: p.show_in_directory,
                showPhonePublic: p.show_phone_public,
              }}
            />

            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="ref-h">
              <h2 id="ref-h" className="h3">
                Referrals ({refRes.data?.length ?? 0})
              </h2>
              {!refRes.data?.length ? (
                <EmptyState title="No referrals yet" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {refRes.data.map((r) => {
                    const sent = r.from_id === p.id;
                    return (
                      <li key={r.id} className="border-line flex flex-col gap-3 rounded-xl border p-4">
                        <p className="text-ink-muted m-0 text-sm">
                          {sent ? `Sent to ${name(r.to)}` : `Received from ${name(r.from)}`} · {when(r.created_at)}
                        </p>
                        <ReferralEditForm
                          r={{
                            id: r.id,
                            contact_name: r.contact_name,
                            status: r.status,
                            amount: r.amount,
                            notes: r.notes,
                            created_at: r.created_at,
                            referred_on: localDateKey(new Date(r.created_at)),
                            closed_on: r.closed_at ? localDateKey(new Date(r.closed_at)) : null,
                            other: sent ? name(r.to) : name(r.from),
                            direction: sent ? 'sent' : 'received',
                          }}
                        />
                        <ConfirmDelete action={adminDeleteReferral} id={r.id} what={`referral ${r.contact_name}`} className="self-start" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="oo-h">
              <h2 id="oo-h" className="h3">
                One-on-ones ({ooRes.data?.length ?? 0})
              </h2>
              {!ooRes.data?.length ? (
                <EmptyState title="No one-on-ones yet" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {ooRes.data.map((o) => {
                    const reported = o.reporter_id === p.id;
                    const other = reported ? name(o.partner) : name(o.reporter);
                    return (
                      <li key={o.id} className="border-line flex flex-col gap-3 rounded-xl border p-4">
                        <p className="m-0 text-sm">
                          <span className="font-bold">With {other}</span>
                          <span className="text-ink-muted">
                            {' '}
                            · {reported ? 'reported by this member' : `reported by ${other}`} · {o.confirmed_at ? 'confirmed' : 'not confirmed'}
                          </span>
                        </p>
                        <OneOnOneEditForm o={{ id: o.id, met_on: o.met_on, confirmed_at: o.confirmed_at, other, reported }} />
                        <ConfirmDelete action={adminDeleteOneOnOne} id={o.id} what={`one-on-one with ${other}`} className="self-start" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="req-h">
              <h2 id="req-h" className="h3">
                One-on-one requests ({reqRes.data?.length ?? 0})
              </h2>
              {!reqRes.data?.length ? (
                <EmptyState title="No requests" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {reqRes.data.map((q) => {
                    const asked = q.requester_id === p.id;
                    return (
                      <li key={q.id} className="border-line flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                        <span className="text-sm">
                          <span className="font-bold">{asked ? `Asked ${name(q.invitee)}` : `Asked by ${name(q.requester)}`}</span>
                          <span className="text-ink-muted">
                            {' '}
                            · {when(q.created_at)}
                            {q.proposed_on ? ` · proposed ${day(q.proposed_on)}` : ''} ·{' '}
                            <Pill tone={q.status === 'pending' ? 'amber' : q.status === 'accepted' ? 'green' : 'gray'}>{q.status}</Pill>
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          {(['pending', 'accepted', 'declined', 'cancelled'] as const)
                            .filter((s) => s !== q.status)
                            .map((s) => (
                              <form key={s} action={adminSetOneOnOneRequest}>
                                <input type="hidden" name="id" value={q.id} />
                                <input type="hidden" name="status" value={s} />
                                <button type="submit" className="btn btn-outline btn-sm">
                                  Mark {s}
                                </button>
                              </form>
                            ))}
                          <ConfirmDelete action={adminDeleteOneOnOneRequest} id={q.id} what="request" />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-5">
            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="role-h">
              <h2 id="role-h" className="h3">
                Admin role
              </h2>
              <RoleForm id={p.id} role={p.role} isSelf={isSelf} isOwner={p.is_owner} />
              {!viewer.profile.is_owner ? <p className="text-ink-muted m-0 text-sm">Only Viv, Ced, Rachanee and Shermaine can add or remove admins.</p> : null}
            </section>

            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="media-h">
              <h2 id="media-h" className="h3">
                Photo and logo
              </h2>
              <div className="flex flex-wrap gap-5">
                {(
                  [
                    ['avatar', 'Photo', avatar],
                    ['logo', 'Logo', logo],
                  ] as const
                ).map(([kind, label, url]) => (
                  <div key={kind} className="flex flex-col items-start gap-2">
                    <span className="label">{label}</span>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" width={96} height={96} className="border-line h-24 w-24 rounded-xl border object-cover" />
                    ) : (
                      <span className="text-ink-muted text-sm">None</span>
                    )}
                    {url ? (
                      <form action={adminRemoveMedia}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="kind" value={kind} />
                        <button type="submit" className="btn btn-outline btn-sm text-red">
                          Remove {label.toLowerCase()}
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-ink-muted m-0 text-sm">Members upload their own images from My profile.</p>
            </section>

            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="ev-h">
              <h2 id="ev-h" className="h3">
                Events they host ({evRes.data?.length ?? 0})
              </h2>
              {!evRes.data?.length ? (
                <EmptyState title="No events" />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {evRes.data.map((e) => (
                    <li key={e.id} className="border-line flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                      <span className="text-sm">
                        <Link href={`/events/${e.slug}`} className="font-bold">
                          {e.title}
                        </Link>
                        <span className="text-ink-muted"> · {when(e.starts_at)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Link href={`/events/${e.slug}/edit`} className="btn btn-outline btn-sm">
                          Edit
                        </Link>
                        <ConfirmDelete action={deleteMemberEvent} id={e.id} what={`event ${e.title}`} extra={{ back: '/admin/activity' }} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card flex flex-col gap-3.5 p-[22px]" aria-labelledby="ph-h">
              <h2 id="ph-h" className="h3">
                Gallery photos ({photoRes.data?.length ?? 0})
              </h2>
              {!photoRes.data?.length ? (
                <EmptyState title="No photos" />
              ) : (
                <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
                  {photoRes.data.map((ph) => (
                    <li key={ph.id} className="flex flex-col gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl('gallery', ph.thumb_path) ?? ''} alt={ph.caption} className="aspect-[4/3] w-full rounded-xl object-cover" />
                      <span className="text-sm">{ph.caption}</span>
                      <span className="flex flex-wrap gap-2">
                        <Link href={`/admin/gallery#photo-${ph.id}`} className="btn btn-outline btn-sm">
                          Edit caption
                        </Link>
                        <ConfirmDelete action={adminDeleteGalleryPhoto} id={ph.id} what={`photo ${ph.caption}`} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
