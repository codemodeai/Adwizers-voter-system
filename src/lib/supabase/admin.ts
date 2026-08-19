import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL, supabaseSecretKey } from "@/lib/env";

/**
 * Service-role client -- bypasses RLS.
 *
 * Used for exactly two things in this phase:
 *   1. Writing a public Form 1 submission (the applicants table grants `anon`
 *      nothing, so there is no public API surface on it at all).
 *   2. Uploading to / signing URLs for the private applicant-logos bucket.
 *
 * `server-only` makes importing this from a client component a build error.
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
