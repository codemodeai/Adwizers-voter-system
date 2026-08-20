/**
 * Admins sign in with a short ID -- `AWE.adwizers` -- rather than a full email.
 *
 * Supabase Auth only authenticates by email, so an ID is resolved to one on a
 * fixed domain before it reaches `signInWithPassword`. The mapping is total and
 * reversible: one ID is always the same address, so nothing has to be stored to
 * look it up.
 *
 * Anything already containing "@" is treated as a full address and passed
 * through untouched, which keeps the original email-based accounts working.
 */

/** Domain the short IDs live on. Owned by us, so the addresses are real. */
export const ADMIN_ID_DOMAIN = "adwizersnetworks.in";

/**
 * Turns whatever was typed in the ID field into the email Supabase expects.
 * Lower-cased throughout: Supabase treats addresses case-insensitively, and
 * `AWE.adwizers` and `awe.adwizers` must not become two different accounts.
 */
export function resolveAdminEmail(identifier: string): string {
  const id = identifier.trim().toLowerCase();
  if (!id) return "";
  return id.includes("@") ? id : `${id}@${ADMIN_ID_DOMAIN}`;
}

/**
 * The inverse, for display. Addresses on the ID domain show as the bare ID the
 * admin actually typed; anything else shows in full.
 */
export function displayAdminId(email: string): string {
  const suffix = `@${ADMIN_ID_DOMAIN}`;
  const value = email.trim();
  return value.toLowerCase().endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}
