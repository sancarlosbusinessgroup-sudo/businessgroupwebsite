/** A member's name, or "Former member" when their account was deleted (owner, 2026-10-23). */
export const personName = (p: { first_name: string; last_name: string } | null | undefined) => (p ? `${p.first_name} ${p.last_name}` : 'Former member');

/**
 * The website support staff (Cedrick Velasco, Shermaine Benolirao, Rachanee Munar) have accounts with the business
 * name "Support Team". They support the members and the site, so member-only profile parts such as "How to refer me"
 * are left off their profiles (owner, 2026-10-30).
 */
export const isSupportStaff = (p: { business_name: string | null } | null | undefined) => p?.business_name?.trim().toLowerCase() === 'support team';
