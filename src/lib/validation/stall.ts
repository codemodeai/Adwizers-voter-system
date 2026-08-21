import { z } from "zod";

import { STALL_CATEGORIES, STALL_FEE_DISPLAY, STALL_GOALS } from "@/lib/carnival";
import { optionalUrl, optionalWhatsappUrl, phone, trimmed } from "@/lib/validation/shared";

const requiredText = (label: string, max = 200) =>
  trimmed.min(1, `${label} is required`).max(max, `${label} must be under ${max} characters`);

const optionalText = (max = 2000) =>
  trimmed
    .max(max, `Please keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

const CATEGORY_SLUGS = STALL_CATEGORIES.map((c) => c.value);
const GOAL_SLUGS = STALL_GOALS.map((g) => g.value);

/**
 * The Business Carnival stall booking form, question by question.
 *
 * The client validates with this a step at a time; the server action re-runs
 * the whole thing before anything reaches the database.
 */
export const stallFormSchema = z.object({
  // Q1-Q4
  fullName: requiredText("Full name", 120),
  whatsappNumber: phone,
  areaLocation: requiredText("Area / location", 160),
  businessName: requiredText("Business / brand name", 160),

  // Q5-Q7
  businessAbout: optionalText(4000),
  stallCategory: trimmed
    .min(1, "Please choose your business category")
    .refine((v) => CATEGORY_SLUGS.includes(v), "Please choose your business category"),
  yearsInBusiness: optionalText(60),

  // Q8, Q11, Q12
  stallProducts: optionalText(4000),
  stallRequirements: optionalText(4000),
  stallGoals: z
    .array(trimmed)
    .default([])
    .transform((values) => values.filter((v) => GOAL_SLUGS.includes(v))),

  // Q10 -- Q9 is the photo, handled as a file alongside this schema
  socialInstagram: optionalUrl,
  socialFacebook: optionalUrl,
  socialWebsite: optionalUrl,
  socialWhatsapp: optionalWhatsappUrl,

  // Fee agreement and consent
  feeAgreed: z.coerce
    .boolean()
    .refine((v) => v === true, `Please confirm you agree to pay the ${STALL_FEE_DISPLAY} stall fee`),
  termsAccepted: z.coerce
    .boolean()
    .refine((v) => v === true, "Please accept the terms & conditions"),
  communicationConsent: z.coerce
    .boolean()
    .refine((v) => v === true, "Please accept the communication consent"),
});

export type StallFormValues = z.input<typeof stallFormSchema>;
export type StallFormParsed = z.output<typeof stallFormSchema>;
