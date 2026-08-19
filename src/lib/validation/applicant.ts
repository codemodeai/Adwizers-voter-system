import { z } from "zod";

/** Category slug that unlocks the free-text "please specify" field. */
export const OTHER_CATEGORY_SLUG = "other";

/** Server-side ceiling. Matches the storage bucket's own file_size_limit. */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * What the applicant may *pick*. The browser downscales before posting, so a
 * large phone photo is fine -- this only rejects the genuinely absurd.
 */
export const MAX_LOGO_SOURCE_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const trimmed = z.string().trim();

const requiredText = (label: string, max = 200) =>
  trimmed.min(1, `${label} is required`).max(max, `${label} must be under ${max} characters`);

const optionalText = (max = 2000) =>
  trimmed
    .max(max, `Please keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Accepts what people actually type -- "+91 98765 43210", "09876543210" --
 * and stores the digits with a leading + if one was given.
 */
const phone = trimmed
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
const optionalUrl = trimmed
  .max(500, "That link is too long")
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  })
  .refine((v) => {
    if (!v) return true;
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid link");

const acceptedCheckbox = (message: string) =>
  z.coerce.boolean().refine((v) => v === true, message);

/**
 * Form 1, question by question (Final Plan section 3).
 * The client validates with this for instant feedback; the server action
 * re-validates with the same schema before anything reaches the database.
 */
export const applicantFormSchema = z
  .object({
    // Q1-Q5
    fullName: requiredText("Full name", 120),
    whatsappNumber: phone,
    email: trimmed.min(1, "Email address is required").email("Enter a valid email address"),
    areaLocation: requiredText("Area / location", 160),
    businessName: requiredText("Business / brand name", 160),
    profession: requiredText("Business / profession", 160),

    // Q6
    categoryId: z.coerce.number().int().positive("Please choose a business category"),
    categoryOther: optionalText(120),

    // Q7-Q9
    yearsInBusiness: optionalText(60),
    businessJourney: optionalText(4000),
    proudestAchievement: optionalText(4000),

    // Q10
    socialInstagram: optionalUrl,
    socialFacebook: optionalUrl,
    socialWebsite: optionalUrl,
    socialWhatsapp: optionalUrl,

    // Q12-Q13
    interestedInNomination: z.enum(["yes", "maybe"], {
      message: "Please tell us if you are interested in nomination",
    }),
    wantsWhatsappUpdates: z.coerce.boolean().default(false),

    // Q14-Q16
    nominationDeclaration: acceptedCheckbox("Please accept the nomination declaration"),
    termsAccepted: acceptedCheckbox("Please accept the terms & conditions"),
    communicationConsent: z.coerce.boolean().default(false),

    /** Slug of the chosen category -- lets the schema enforce the Q6 follow-up. */
    categorySlug: trimmed.optional(),
  })
  .superRefine((values, ctx) => {
    if (values.categorySlug === OTHER_CATEGORY_SLUG && !values.categoryOther) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryOther"],
        message: "Please tell us which category you belong to",
      });
    }
  });

export type ApplicantFormValues = z.input<typeof applicantFormSchema>;
export type ApplicantFormParsed = z.output<typeof applicantFormSchema>;

export function validateLogoFile(file: File | null | undefined): string | null {
  if (!file || file.size === 0) return null; // Q11 is optional
  if (!ACCEPTED_LOGO_TYPES.includes(file.type as (typeof ACCEPTED_LOGO_TYPES)[number])) {
    return "Upload a JPG, PNG, or WebP image";
  }
  if (file.size > MAX_LOGO_BYTES) {
    return "Image must be 5 MB or smaller";
  }
  return null;
}
