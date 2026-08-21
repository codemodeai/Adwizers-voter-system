import "server-only";

import type { Email } from "@/lib/email/resend";

/**
 * The nominee selection email (Final Plan sections 3 and 4) -- sent the moment
 * an applicant is promoted and her card goes live on the category page.
 *
 * Written to state only what is certainly true at send time: she is a nominee,
 * this is her category, and this is the page her card is on. It promises no
 * voting dates, because the voting window is set later in the dashboard
 * (section 10) and an email cannot be unsent once a date in it changes.
 *
 * Inline styles and a table shell, because that is what email clients render
 * predictably -- Gmail strips <style> blocks and Outlook ignores flexbox.
 */
export function nomineeSelectedEmail(params: {
  to: string;
  name: string;
  businessName: string;
  categoryName: string;
  /** Absolute URL of her category's voting page, or null when the public
   *  origin is not configured (local development). */
  voteUrl: string | null;
}): Email {
  const { to, name, businessName, categoryName, voteUrl } = params;

  const firstName = name.trim().split(/\s+/)[0] || name.trim();
  const subject = `You're a nominee — AWE Awards 2026 (${categoryName})`;

  const text = [
    `Hi ${firstName},`,
    "",
    `Your entry has been selected as a nominee in the AWE Awards 2026.`,
    "",
    `Category: ${categoryName}`,
    `Business: ${businessName}`,
    "",
    voteUrl
      ? `Your nominee card is now on your category's page: ${voteUrl}`
      : `Your nominee card is now on your category's page.`,
    "",
    "Public voting opens shortly. We will let you know the moment it does, so you can share your category page with your customers and community.",
    "",
    "Congratulations,",
    "Team AWE Awards 2026",
    "Adwizers Networks",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#faf8fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8fb;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e1ec;">

          <tr>
            <td style="background:#33004a;padding:24px 28px;">
              <p style="margin:0;font:600 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#c68f45;">
                AWE Awards 2026
              </p>
              <p style="margin:6px 0 0;font:700 22px/1.3 Arial,Helvetica,sans-serif;color:#ffffff;">
                You&rsquo;re a nominee
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 28px 8px;">
              <p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#2a2a2a;">
                Hi ${escapeHtml(firstName)},
              </p>
              <p style="margin:0 0 18px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#2a2a2a;">
                Your entry has been selected as a nominee in the AWE Awards 2026. Your card is now
                live on your category&rsquo;s page.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4ecf8;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#6b6472;">Category</p>
                    <p style="margin:2px 0 12px;font:700 15px/1.4 Arial,Helvetica,sans-serif;color:#33004a;">${escapeHtml(categoryName)}</p>
                    <p style="margin:0;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#6b6472;">Business</p>
                    <p style="margin:2px 0 0;font:700 15px/1.4 Arial,Helvetica,sans-serif;color:#33004a;">${escapeHtml(businessName)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            voteUrl
              ? `<tr>
            <td style="padding:20px 28px 4px;" align="center">
              <a href="${escapeAttr(voteUrl)}"
                 style="display:inline-block;background:#c2006e;color:#ffffff;text-decoration:none;
                        font:700 15px/1 Arial,Helvetica,sans-serif;padding:14px 30px;border-radius:8px;">
                See your category page
              </a>
            </td>
          </tr>`
              : ""
          }

          <tr>
            <td style="padding:20px 28px 26px;">
              <p style="margin:0 0 16px;font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#2a2a2a;">
                Public voting opens shortly. We&rsquo;ll let you know the moment it does, so you can
                share your category page with your customers and community.
              </p>
              <p style="margin:0;font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#2a2a2a;">
                Congratulations,<br>
                <strong style="color:#33004a;">Team AWE Awards 2026</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid #e7e1ec;padding:14px 28px;">
              <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#6b6472;">
                AWE Awards 2026 &middot; Adwizers Networks &mdash; you are receiving this because you
                entered the awards.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { to, subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** URLs go into an href, where a stray quote would break out of the attribute. */
function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
