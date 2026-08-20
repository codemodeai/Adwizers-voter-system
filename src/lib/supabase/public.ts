import { createClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Anonymous client for public, non-personalised reads -- currently just the
 * active category list on the entry form.
 *
 * The distinction from `createClient()` in ./server.ts is what it *doesn't* do:
 * it never touches cookies. Reading cookies opts a route out of static
 * rendering, so using the session-bearing client to fetch data that is
 * identical for every visitor forced /register to be rendered per request, with
 * a Supabase round trip in front of it each time.
 *
 * Still subject to RLS as `anon`, which is exactly the access this needs -- the
 * categories table has a public read policy and nothing else is reachable.
 */
export function createPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
