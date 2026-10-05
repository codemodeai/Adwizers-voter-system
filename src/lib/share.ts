/**
 * Sharing a nominee's personal voting link -- shared by the dashboard (an
 * admin sending a nominee her link) and the public page (a supporter passing
 * it on). Plain functions with no server imports, so client components can use
 * them.
 */

/**
 * A phone number as wa.me wants it: digits only, with the country code.
 *
 * Entries are typed by hand on an Indian form, so a bare ten-digit mobile is
 * taken as Indian (+91), and a leading trunk 0 is dropped. Anything that does
 * not look like a usable number gives null, and the caller falls back to
 * WhatsApp's own contact picker rather than opening a chat with a wrong number.
 */
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0")) return digits;

  return null;
}

/**
 * A wa.me link that opens WhatsApp with `text` filled in -- straight into a
 * chat with `phone` when there is one, otherwise at the contact picker.
 */
export function whatsappShareUrl(text: string, phone?: string | null): string {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}

/**
 * Makes a link absolute in the browser. Links are absolute whenever
 * FORM_ORIGIN is configured; this covers local development, where they are
 * paths and a pasted path is useless.
 */
export function absoluteInBrowser(url: string): string {
  if (/^https?:\/\//i.test(url) || typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}

/** What the admin sends a nominee along with her link. */
export function nomineeInviteMessage(params: {
  name: string;
  categoryName: string | null;
  code: string;
  url: string;
}): string {
  const firstName = params.name.trim().split(/\s+/)[0] || params.name.trim();
  return [
    `Hi ${firstName}, congratulations on your nomination at the AWE Awards 2026${
      params.categoryName ? ` (${params.categoryName})` : ""
    }!`,
    "",
    "Here is your personal voting link:",
    params.url,
    "",
    "Share it with your customers, friends and family — every vote on this link counts for you.",
    "",
    `Your Nominee ID: ${params.code}`,
  ].join("\n");
}

/** What a supporter sends on, from the nominee's own page. */
export function supporterShareMessage(params: {
  name: string;
  businessName: string;
  categoryName: string;
  url: string;
}): string {
  return [
    `Please vote for ${params.name} (${params.businessName}) — nominated for ${params.categoryName} at the AWE Awards 2026.`,
    "",
    params.url,
  ].join("\n");
}
