/**
 * Voter mobile numbers: checked to look like a real number, and reduced to one
 * standard form before they are stored or compared.
 *
 * The standard form is what makes "one vote per mobile number" mean one vote
 * per *number* rather than per way of typing it -- `98765 43210`,
 * `98765-43210`, `09876543210`, `919876543210` and `+91 98765 43210` are all
 * the same phone, and all become `+919876543210`.
 *
 * This is the free check: it cannot prove the voter owns the number (that
 * needs an SMS or WhatsApp code, which costs money per message), but it does
 * refuse numbers that cannot exist and the obvious typed-to-get-past-the-form
 * fakes.
 *
 * No server-only imports, so the ballot can use the same rule for its hint.
 */

export type MobileResult = { ok: true; mobile: string } | { ok: false; error: string };

const INDIA_INVALID =
  "Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9).";

/** All one digit (9999999999), or the counting-down / counting-up numbers
 *  people type to get past a form (9876543210, 6789012345). */
function looksFake(tenDigits: string): boolean {
  if (/^(\d)\1{9}$/.test(tenDigits)) return true;
  return tenDigits === "9876543210" || tenDigits === "6789012345";
}

export function normaliseMobile(raw: string): MobileResult {
  // Brackets carry no meaning in a phone number -- "(+91) 63836 98878" -- so
  // they go first, which also lets a + written inside them count as leading.
  const trimmed = raw.replace(/[()]/g, "").trim();
  if (!trimmed) return { ok: false, error: "Please enter your mobile number." };

  // Only digits, spaces, dashes, dots and one leading +.
  if (!/^\+?[\d\s\-.]+$/.test(trimmed)) return { ok: false, error: INDIA_INVALID };

  const international = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  // A number from outside India keeps its own country code. Checked only for a
  // plausible length (E.164 allows up to 15 digits), since numbering rules
  // differ by country.
  if (international && !digits.startsWith("91")) {
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, error: "Please check the mobile number, including the country code." };
    }
    return { ok: true, mobile: `+${digits}` };
  }

  // Indian: strip +91 / 91 / a leading trunk 0 down to the ten digits.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  if (!/^[6-9]\d{9}$/.test(digits)) return { ok: false, error: INDIA_INVALID };
  if (looksFake(digits)) {
    return { ok: false, error: "Please enter your own mobile number." };
  }

  return { ok: true, mobile: `+91${digits}` };
}
