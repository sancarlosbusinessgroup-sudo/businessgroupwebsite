// Live chat through Tidio (free plan; the support team answers in the Tidio phone app or dashboard).
// Switched on by one public environment variable, NEXT_PUBLIC_TIDIO_PUBLIC_KEY: the part of Tidio's embed code
// //code.tidio.co/PUBLIC_KEY.js (Tidio → Settings → Installation). It is public (it appears in every page), not a secret.

export type TidioConfig = { publicKey: string };
export type ChatVisitor = { id: string; name: string; email?: string };

const PUBLIC_KEY = /^[a-z0-9]{20,64}$/;
const FROM_EMBED = /code\.tidio\.co\/([a-z0-9]{20,64})\.js/;

/** The Tidio key when it is set and well-formed (the whole embed code is accepted too); otherwise null (chat off). */
export function tidioConfig(value: string | undefined): TidioConfig | null {
  const v = value?.trim() ?? '';
  const key = PUBLIC_KEY.test(v) ? v : FROM_EMBED.exec(v)?.[1];
  return key ? { publicKey: key } : null;
}

/** Reads the key from the environment (inlined at build time). */
export function tidioConfigFromEnv(): TidioConfig | null {
  return tidioConfig(process.env.NEXT_PUBLIC_TIDIO_PUBLIC_KEY);
}

export function tidioScriptUrl({ publicKey }: TidioConfig): string {
  return `https://code.tidio.co/${publicKey}.js`;
}

/** Pages where the chat bubble would get in the way (the full-screen meeting slides). */
export function chatHiddenOn(pathname: string): boolean {
  return pathname === '/present' || pathname.startsWith('/present/');
}

/** Member id, name and email shown to the support team for a signed-in member (the id lets Tidio keep their chats together). */
export function chatVisitor(
  userId: string | null,
  profile: { first_name: string | null; last_name: string | null } | null,
  email: string | null,
): ChatVisitor | undefined {
  if (!userId || !profile) return undefined;
  const name = [profile.first_name, profile.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
  if (!name) return undefined;
  return email ? { id: userId, name, email } : { id: userId, name };
}
