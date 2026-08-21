import "server-only";

/**
 * Resend transport (Final Plan section 3).
 *
 * Called over plain fetch rather than the SDK: one POST to one endpoint does
 * not justify a dependency, and this keeps the send path readable end to end.
 *
 * Two rules shape everything here:
 *
 *  1. **Email never blocks the workflow.** Promotion is an admin action on real
 *     data; a Resend outage, an unverified domain, or a missing key must not
 *     leave an applicant half-promoted. Every failure comes back as a value,
 *     never a throw, and the caller records it on the nominee so it can be
 *     retried from the dashboard.
 *  2. **Not configured is a normal state, not an error.** Until the sending
 *     domain is verified, `RESEND_API_KEY` is simply absent and sends report
 *     `skipped` -- which the nominee screen shows as "not sent yet" with a
 *     Send button, rather than as something broken.
 */

export type SendResult =
  | { status: "sent"; id: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

const ENDPOINT = "https://api.resend.com/emails";

/**
 * Fallback sender. Resend's shared onboarding domain works without any DNS
 * setup, which makes the whole path testable before the real domain is
 * verified -- but it can only deliver to the Resend account's own address, so
 * production must set RESEND_FROM to an address on the verified domain.
 */
const DEFAULT_FROM = "AWE Awards 2026 <onboarding@resend.dev>";

function apiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

export function resendConfigured(): boolean {
  return apiKey() !== null;
}

/** Whether the sender is still the shared testing domain, which only delivers
 *  to the Resend account owner. Surfaced in the dashboard so a run of
 *  "sent" emails that nobody received is explainable. */
export function usingTestSender(): boolean {
  return !process.env.RESEND_FROM?.trim();
}

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail(email: Email): Promise<SendResult> {
  const key = apiKey();
  if (!key) {
    return { status: "skipped", reason: "RESEND_API_KEY is not set." };
  }

  const to = email.to.trim();
  if (!to) return { status: "skipped", reason: "No email address on file." };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM?.trim() || DEFAULT_FROM,
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      // A slow provider must not hold an admin's click open indefinitely.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Resend returns { message, name } on error; fall back to the status when
      // the body is not JSON at all.
      const body = await response.text();
      let message = `Resend returned ${response.status}`;
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        if (body) message = body.slice(0, 200);
      }
      return { status: "failed", error: message };
    }

    const data = (await response.json()) as { id?: string };
    return { status: "sent", id: data.id ?? null };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "TimeoutError"
          ? "Resend did not respond in time."
          : error.message
        : "Unknown error sending email.";
    return { status: "failed", error: message };
  }
}
