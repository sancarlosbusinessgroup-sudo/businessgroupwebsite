// Public runtime configuration. Values come from environment variables only.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl() {
    // On Vercel, fall back to the project's public production domain (exposed automatically for Next.js),
    // not the per-deployment URL, which is behind Vercel login.
    const vercelProd = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    const fallback = vercelProd ? `https://${vercelProd}` : 'http://localhost:3000';
    return (process.env.NEXT_PUBLIC_SITE_URL || fallback).replace(/\/$/, '');
  },
};

/** Public URL for a stored image. Paths starting with "/" are files shipped in /public (seed data). */
export function mediaUrl(bucket: 'gallery' | 'profile-media', path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('/')) return path;
  return `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
