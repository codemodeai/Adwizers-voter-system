import { stallCategoryLabel } from "@/lib/carnival";

export type ApplicantStatus = "new" | "payment_received" | "promoted" | "rejected";

/** Which entry form a row came from. Award entries are Form 1; stall entries
 *  are Business Carnival bookings. */
export type FormType = "award" | "stall";

export const FORM_TYPES: FormType[] = ["award", "stall"];

export const FORM_TYPE_LABEL: Record<FormType, string> = {
  award: "Award",
  stall: "Business",
};
export type NominationInterest = "yes" | "maybe";

export const APPLICANT_STATUSES: ApplicantStatus[] = [
  "new",
  "payment_received",
  "promoted",
  "rejected",
];

export const STATUS_LABEL: Record<ApplicantStatus, string> = {
  new: "New",
  payment_received: "Payment Received",
  promoted: "Promoted to Nominee",
  rejected: "Rejected",
};

/** Short forms for tight spots like the card corner, where "Promoted to
 *  Nominee" would crowd out the applicant's name. */
export const STATUS_LABEL_SHORT: Record<ApplicantStatus, string> = {
  new: "New",
  payment_received: "Paid",
  promoted: "Nominee",
  rejected: "Rejected",
};

/** Tailwind classes per status, used by the badge in the applicants list. */
export const STATUS_STYLE: Record<ApplicantStatus, string> = {
  new: "bg-purple-soft text-purple-royal ring-purple-royal/15",
  payment_received: "bg-gold-soft text-gold-champagne ring-gold-champagne/25",
  promoted: "bg-magenta-soft text-magenta-royal ring-magenta-royal/20",
  rejected: "bg-neutral-100 text-neutral-500 ring-neutral-300",
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

export type Applicant = {
  id: string;
  form_type: FormType;
  full_name: string;
  whatsapp_number: string;
  email: string | null;
  area_location: string;
  business_name: string;
  profession: string;
  category_id: number | null;
  category_other: string | null;
  years_in_business: string | null;
  business_journey: string | null;
  proudest_achievement: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_website: string | null;
  social_whatsapp: string | null;
  logo_path: string | null;
  interested_in_nomination: NominationInterest | null;
  stall_category: string | null;
  business_about: string | null;
  stall_products: string | null;
  stall_requirements: string | null;
  stall_goals: string[] | null;
  fee_agreed_at: string | null;
  fee_amount_inr: number | null;
  wants_whatsapp_updates: boolean;
  nomination_declaration_at: string | null;
  terms_accepted_at: string;
  communication_consent_at: string | null;
  status: ApplicantStatus;
  payment_received_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicantWithCategory = Applicant & {
  categories: Pick<Category, "id" | "name" | "slug"> | null;
};

/**
 * Resolves the display category, honouring the "Other" free-text answer.
 *
 * Stall entries answer a different category question with its own eleven
 * options, so they resolve against that list instead of the award categories.
 */
export function categoryLabel(applicant: ApplicantWithCategory): string {
  if (applicant.form_type === "stall") {
    return stallCategoryLabel(applicant.stall_category) ?? "Uncategorised";
  }
  if (applicant.categories?.slug === "other" && applicant.category_other) {
    return `Other -- ${applicant.category_other}`;
  }
  return applicant.categories?.name ?? "Uncategorised";
}

/**
 * The public face of a promoted applicant (Final Plan sections 4 and 6).
 *
 * Deliberately its own row rather than fields on the applicant: the admin
 * polishes this copy for the voting page, and none of that may reach back into
 * what she actually submitted on Form 1.
 */
export type Nominee = {
  id: string;
  /**
   * Her nominee number, AWE2026-001 -- assigned by the database at promotion
   * and quoted in the selection email. Nullable only for the window before the
   * migration that adds the column has been run; every row has one after that.
   */
  code: string | null;
  applicant_id: string;
  category_id: number;
  display_name: string;
  business_name: string;
  area_location: string | null;
  bio: string | null;
  photo_path: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_website: string | null;
  social_whatsapp: string | null;
  is_published: boolean;
  sort_order: number;
  notified_at: string | null;
  notify_email: string | null;
  notify_error: string | null;
  created_at: string;
  updated_at: string;
};

export type NomineeWithCategory = Nominee & {
  categories: Pick<Category, "id" | "name" | "slug"> | null;
};

/** Where a nominee's notification actually got to, for the dashboard badge. */
export type NotifyState = "sent" | "failed" | "none";

export function notifyState(nominee: Pick<Nominee, "notified_at" | "notify_error">): NotifyState {
  if (nominee.notified_at) return "sent";
  if (nominee.notify_error) return "failed";
  return "none";
}
