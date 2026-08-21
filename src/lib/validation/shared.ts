import { z } from "zod";

/* Field rules both entry forms need: the same phone number, the same tolerance
 * for a link pasted without its protocol. Kept here so the awards form and the
 * carnival form cannot drift apart on what they accept. */

export const trimmed = z.string().trim();

/**
 * Accepts what people actually type -- "+91 98765 43210", "09876543210" --
 * and stores the digits with a leading + if one was given.
 */
export const phone = trimmed
  .min(1, "WhatsApp number is required")
  .transform((v) => {
    const digits = v.replace(/[^\d]/g, "");
    return v.trim().startsWith("+") ? `+${digits}` : digits;
  })
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Enter a valid WhatsApp number (10-15 digits)");

/** People paste "instagram.com/awe" as often as a full URL; accept both. */
export const optionalUrl = trimmed
  .max(500, "That link is too long")
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  })
  .refine((v) => {
    if (!v) return true;
    try {
      const host = new URL(v).hostname.toLowerCase();
      // A bare word or a phone number parses as a URL quite happily, so the
      // host has to look like a real domain before we call this a link.
      return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host);
    } catch {
      return false;
    }
  }, "Enter a valid link");

/**
 * The WhatsApp field asks for a link, but a number is what people reach for --
 * the form turns one into a wa.me link as they type, and this does the same
 * for anything that arrives without having been through it.
 */
export const optionalWhatsappUrl = z.preprocess((raw) => {
  if (typeof raw !== "string") return raw;
  const value = raw.trim();
  if (!/^\+?[\d\s()-]+$/.test(value)) return raw;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 11 && digits.length <= 15 ? `https://wa.me/${digits}` : raw;
}, optionalUrl);
