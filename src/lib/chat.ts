// Live chat through tawk.to (free; the support team answers in the tawk.to phone app or dashboard).
// Switched on by two public environment variables: NEXT_PUBLIC_TAWK_PROPERTY_ID and NEXT_PUBLIC_TAWK_WIDGET_ID
// (tawk.to → Administration → Chat Widget; the embed link is embed.tawk.to/PROPERTY_ID/WIDGET_ID).
// These IDs are public (they appear in every page's embed code), not secrets.

export type TawkConfig = { propertyId: string; widgetId: string };
export type ChatVisitor = { name: string; email?: string };

const PROPERTY_ID = /^[a-f0-9]{24}$/i;
const WIDGET_ID = /^[a-z0-9]{1,32}$/i;

/** The tawk.to IDs when both are set and well-formed; otherwise null (chat off). */
export function tawkConfig(propertyId: string | undefined, widgetId: string | undefined): TawkConfig | null {
  const p = propertyId?.trim() ?? '';
  const w = widgetId?.trim() ?? '';
  if (!PROPERTY_ID.test(p) || !WIDGET_ID.test(w)) return null;
  return { propertyId: p, widgetId: w };
}

/** Reads the IDs from the environment (inlined at build time). */
export function tawkConfigFromEnv(): TawkConfig | null {
  return tawkConfig(process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID, process.env.NEXT_PUBLIC_TAWK_WIDGET_ID);
}

export function tawkEmbedUrl({ propertyId, widgetId }: TawkConfig): string {
  return `https://embed.tawk.to/${propertyId}/${widgetId}`;
}

/** Pages where the chat bubble would get in the way (the full-screen meeting slides). */
export function chatHiddenOn(pathname: string): boolean {
  return pathname === '/present' || pathname.startsWith('/present/');
}

/** Name and email shown to the support team for a signed-in member. */
export function chatVisitor(profile: { first_name: string | null; last_name: string | null } | null, email: string | null): ChatVisitor | undefined {
  if (!profile) return undefined;
  const name = [profile.first_name, profile.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
  if (!name) return undefined;
  return email ? { name, email } : { name };
}
