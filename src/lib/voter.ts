import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";

import { supabaseSecretKey } from "@/lib/env";

/**
 * The two signals recorded alongside every vote besides what the voter types:
 * a salted hash of her IP, and a device id. Both feed the rate limits and the
 * vote records; neither decides on its own whether a vote counts -- that is
 * the mobile number and email (see the unique indexes on public.votes).
 */

export const DEVICE_COOKIE = "awe_did";

/**
 * Salted hash, so the IP is stored but never held in the clear.
 *
 * The salt is derived from the service key rather than kept in its own variable
 * -- one fewer secret to configure and lose, and it is already the most
 * protected value this deployment has. Rotating it invalidates old hashes,
 * which for rate-limit buckets is harmless.
 */
function digest(value: string, scope: string): string {
  return createHash("sha256").update(`${scope}:${supabaseSecretKey()}:${value}`).digest("hex");
}

export function hashIp(ip: string | null): string | null {
  return ip ? digest(ip, "ip") : null;
}

/**
 * The caller's IP, as the platform reports it.
 *
 * `x-forwarded-for` is a client-settable header everywhere except behind a
 * proxy that overwrites it -- which Vercel does. This is trustworthy on Vercel
 * and would not be if the app were ever served directly.
 */
export async function callerIp(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return store.get("x-real-ip");
}

/**
 * The device id (section 8), read from the cookie or minted here.
 *
 * The client also keeps a copy in localStorage and sends it along; this is the
 * server's own record so that clearing localStorage alone does not hand someone
 * a clean slate. It drives the hourly per-device rate limit only -- it no
 * longer blocks a second vote.
 */
export async function ensureDeviceId(clientValue?: string | null): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;

  const id =
    existing ||
    (clientValue && /^[a-zA-Z0-9-]{8,64}$/.test(clientValue) ? clientValue : randomUUID());

  if (!existing) {
    store.set(DEVICE_COOKIE, id, {
      httpOnly: false, // The page reads it to keep localStorage in step.
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return id;
}
