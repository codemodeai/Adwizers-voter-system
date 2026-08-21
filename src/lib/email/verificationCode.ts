import "server-only";

import { sendEmail, type SendResult } from "@/lib/email/resend";

/**
 * The voter's one-time code (Final Plan section 8).
 *
 * A deliberate deviation, recorded here rather than buried: the plan specifies
 * Amazon SES for these, on the grounds that a live voting window could mean
 * tens of thousands of codes and SES's metered rate fits that better than
 * Resend's tiers. No AWS account exists yet, and Resend is already configured
 * and verified on the sending domain -- so codes go out through Resend, behind
 * this one function.
 *
 * The cost of that is a real cap: Resend's free tier allows 100 emails a day.
 * Because verification is once per *session* rather than once per vote, that
 * covers roughly a hundred distinct voters a day, which is fine for a soft
 * launch and not for a peak. Swapping in SES means changing `deliver` below and
 * nothing else -- the callers, the template and the session logic are unaware
 * of which provider ran.
 */

/** Six digits, uniformly distributed. `Math.random()` is not used: this is the
 *  only thing standing between a stranger and someone else's vote. */
export function generateCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

export async function sendVerificationCode(params: {
  to: string;
  code: string;
  minutes: number;
}): Promise<SendResult> {
  const { to, code, minutes } = params;

  const text = [
    `Your AWE Awards 2026 voting code is ${code}.`,
    "",
    `It is valid for ${minutes} minutes and unlocks voting for the rest of your visit.`,
    "",
    "If you did not request this, you can ignore this email — no vote has been cast.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#faf8fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8fb;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:14px;border:1px solid #e7e1ec;overflow:hidden;">
        <tr>
          <td style="background:#33004a;padding:20px 26px;">
            <p style="margin:0;font:600 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#c68f45;">
              AWE Awards 2026
            </p>
            <p style="margin:5px 0 0;font:700 19px/1.3 Arial,Helvetica,sans-serif;color:#ffffff;">
              Your voting code
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 26px 8px;" align="center">
            <p style="margin:0 0 16px;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#2a2a2a;">
              Enter this code on the voting page to confirm it&rsquo;s you.
            </p>
            <p style="margin:0;font:700 34px/1.2 'Courier New',Courier,monospace;letter-spacing:.28em;color:#c2006e;">
              ${code}
            </p>
            <p style="margin:14px 0 0;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#6b6472;">
              Valid for ${minutes} minutes. One code unlocks voting for the rest of your visit.
            </p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e7e1ec;padding:14px 26px;margin-top:20px;">
            <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#6b6472;">
              Didn&rsquo;t request this? Ignore this email — no vote has been cast.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return deliver({ to, subject: `${code} is your AWE Awards voting code`, html, text });
}

/**
 * The provider seam. Everything above is provider-agnostic; swapping Resend for
 * SES is a change to this function alone.
 */
async function deliver(email: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  return sendEmail(email);
}
