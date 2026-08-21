import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseSecretKey } from "@/lib/env";

export const SESSION_COOKIE = "awe_vs";
export const DEVICE_COOKIE = "awe_did";

/** Section 8: five wrong guesses and the session is spent. */
const MAX_CODE_ATTEMPTS = 5;

/**
 * Salted hashes for the two things we store but must not hold in the clear:
 * the voter's IP, and the emailed code.
 *
 * The salt is derived from the service key rather than kept in its own variable
 * -- one fewer secret to configure and lose, and it is already the most
 * protected value this deployment has. Rotating it invalidates old hashes,
 * which for rate-limit buckets and live codes is harmless.
 */
function digest(value: string, scope: string): string {
  return createHash("sha256").update(`${scope}:${supabaseSecretKey()}:${value}`).digest("hex");
}

export function hashIp(ip: string | null): string | null {
  return ip ? digest(ip, "ip") : null;
}

export function hashCode(code: string): string {
  return digest(code, "code");
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

export type VoteSession = {
  id: string;
  email: string;
  verified: boolean;
};

/** The session id the browser is carrying, if any. */
export async function currentSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * A verified session for this email, or null.
 *
 * The email is checked against the session as well as the cookie: a visitor who
 * verifies one address and then types a different one must verify again, or the
 * email signal in section 8's duplicate rules would mean nothing.
 */
export async function verifiedSessionFor(email: string): Promise<VoteSession | null> {
  const id = await currentSessionId();
  if (!id) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vote_sessions")
    .select("id, email, verified_at, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    id: string;
    email: string;
    verified_at: string | null;
    expires_at: string;
  };

  if (!row.verified_at) return null;
  if (new Date(row.expires_at) <= new Date()) return null;
  if (row.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;

  return { id: row.id, email: row.email, verified: true };
}

/** Issues a fresh unverified session holding the hashed code, and cookies it. */
export async function startSession(params: {
  email: string;
  code: string;
  minutes: number;
  ipHash: string | null;
  deviceId: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  const expiresAt = new Date(Date.now() + params.minutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("vote_sessions")
    .insert({
      email: params.email.trim().toLowerCase(),
      code_hash: hashCode(params.code),
      expires_at: expiresAt,
      ip_hash: params.ipHash,
      device_id: params.deviceId,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not start a session." };

  const store = await cookies();
  store.set(SESSION_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: params.minutes * 60,
  });

  return { ok: true, id: data.id };
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Checks a submitted code against the session the browser is carrying.
 *
 * Compared in constant time. The window is small, but a timing oracle on a
 * six-digit code is exactly the kind of thing that is free to avoid and
 * embarrassing to leave in.
 */
export async function verifyCode(email: string, code: string): Promise<VerifyOutcome> {
  const id = await currentSessionId();
  if (!id) return { ok: false, error: "Your session expired. Please start again." };

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vote_sessions")
    .select("id, email, code_hash, attempts, expires_at, verified_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { ok: false, error: "Your session expired. Please start again." };

  const row = data as {
    id: string;
    email: string;
    code_hash: string;
    attempts: number;
    expires_at: string;
    verified_at: string | null;
  };

  if (new Date(row.expires_at) <= new Date()) {
    return { ok: false, error: "That code has expired. Please request a new one." };
  }

  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, error: "Too many wrong codes. Please request a new one." };
  }

  if (row.email !== email.trim().toLowerCase()) {
    return { ok: false, error: "That code was sent to a different email address." };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(code.trim()), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    await supabase
      .from("vote_sessions")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);

    const left = MAX_CODE_ATTEMPTS - row.attempts - 1;
    return {
      ok: false,
      error:
        left > 0
          ? `That code is not right. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many wrong codes. Please request a new one.",
    };
  }

  if (!row.verified_at) {
    await supabase
      .from("vote_sessions")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return { ok: true };
}

/**
 * The device id (section 8), read from the cookie or minted here.
 *
 * The client also keeps a copy in localStorage and sends it along; this is the
 * server's own record so that clearing localStorage alone does not hand someone
 * a clean slate.
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
