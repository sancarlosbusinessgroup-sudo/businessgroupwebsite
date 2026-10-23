/** A member's name, or "Former member" when their account was deleted (owner, 2026-10-23). */
export const personName = (p: { first_name: string; last_name: string } | null | undefined) => (p ? `${p.first_name} ${p.last_name}` : 'Former member');
