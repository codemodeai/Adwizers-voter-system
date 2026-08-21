import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = { ok: true } | { ok: false; error: string };

/**
 * The rate-limit check (Final Plan section 8), run first and deliberately so:
 * it is the cheapest gate, and a burst should be turned away before it costs an
 * email or a Cloudflare round trip.
 *
 * Counted from the votes table itself rather than a separate counter store.
 * That keeps the whole system on one piece of infrastructure and cannot drift
 * out of sync with reality -- the limit is measured against what was actually
 * recorded. It does mean refused attempts are not counted toward the limit,
 * which is the forgiving direction: someone repeatedly clashing on duplicates
 * is not throttled for it.
 */
export async function checkRateLimits(params: {
  ipHash: string | null;
  deviceId: string;
  perIpPerMinute: number;
  perDevicePerHour: number;
}): Promise<RateLimitResult> {
  const supabase = createAdminClient();

  const now = Date.now();
  const minuteAgo = new Date(now - 60_000).toISOString();
  const hourAgo = new Date(now - 60 * 60_000).toISOString();

  const [byIp, byDevice] = await Promise.all([
    params.ipHash
      ? supabase
          .from("votes")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", params.ipHash)
          .gte("created_at", minuteAgo)
      : Promise.resolve({ count: 0, error: null }),
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("device_id", params.deviceId)
      .gte("created_at", hourAgo),
  ]);

  // A failed count must not become an open door. If the table cannot be read,
  // nothing else in this request is going to work either.
  if (byIp.error || byDevice.error) {
    return { ok: false, error: "Could not check voting limits. Please try again shortly." };
  }

  if ((byIp.count ?? 0) >= params.perIpPerMinute) {
    return {
      ok: false,
      error: "Too many votes from this connection just now. Please wait a minute and try again.",
    };
  }

  if ((byDevice.count ?? 0) >= params.perDevicePerHour) {
    return {
      ok: false,
      error: "This device has reached its hourly voting limit. Please try again later.",
    };
  }

  return { ok: true };
}

/**
 * Records a refused attempt (sections 8 and 9): blocked votes are logged for
 * admin review rather than silently discarded, so the dashboard can surface
 * patterns like several attempts on one nominee from one device.
 *
 * Never throws. This runs on the failure path, and a logging error must not
 * replace the real reason the voter was turned away.
 */
export async function logAttempt(params: {
  nomineeId?: string | null;
  categoryId?: number | null;
  matchedSignal: string;
  voterMobile?: string | null;
  voterEmail?: string | null;
  deviceId?: string | null;
  ipHash?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("vote_attempts").insert({
      nominee_id: params.nomineeId ?? null,
      category_id: params.categoryId ?? null,
      matched_signal: params.matchedSignal,
      voter_mobile: params.voterMobile ?? null,
      voter_email: params.voterEmail ?? null,
      device_id: params.deviceId ?? null,
      ip_hash: params.ipHash ?? null,
    });
  } catch {
    // Deliberately swallowed.
  }
}
