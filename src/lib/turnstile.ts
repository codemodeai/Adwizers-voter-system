import "server-only";

/**
 * Cloudflare Turnstile (Final Plan section 8).
 *
 * The token is verified server-side against Cloudflare before anything else
 * happens -- before an email is sent and before the database is touched -- so a
 * missing or forged token costs an attacker a request and nothing else.
 *
 * Tokens are single-use. Cloudflare rejects a replay itself, which is why this
 * does no caching of its own.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Public site key, safe in the browser. Absent means Turnstile is not set up. */
export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

function secretKey(): string | null {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || null;
}

/**
 * Whether Turnstile is fully wired. Both halves are required: a site key with
 * no secret would render a widget nothing ever checks, which is worse than no
 * widget at all because it looks protected.
 */
export function turnstileConfigured(): boolean {
  return Boolean(turnstileSiteKey() && secretKey());
}

export async function verifyTurnstile(
  token: string | null,
  ip: string | null,
): Promise<TurnstileResult> {
  const secret = secretKey();

  // Not configured is a deliberate pass, not a silent one: voting still works
  // before Cloudflare is set up, and the dashboard says loudly that the captcha
  // is missing. Failing closed here would mean a half-finished setup silently
  // blocks every vote.
  if (!secret) return { ok: true };

  if (!token) return { ok: false, reason: "Captcha missing. Please reload the page." };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { ok: false, reason: "Could not check the captcha. Please try again." };
    }

    const data = (await response.json()) as {
      success?: boolean;
      ["error-codes"]?: string[];
    };

    if (data.success) return { ok: true };

    const codes = data["error-codes"] ?? [];
    // The two an ordinary person actually hits: a token that expired while they
    // filled the form, and one already spent by a double submit.
    if (codes.includes("timeout-or-duplicate")) {
      return { ok: false, reason: "That captcha has expired. Please reload and try again." };
    }
    return { ok: false, reason: "Captcha check failed. Please reload the page." };
  } catch {
    return { ok: false, reason: "Could not reach the captcha service. Please try again." };
  }
}
